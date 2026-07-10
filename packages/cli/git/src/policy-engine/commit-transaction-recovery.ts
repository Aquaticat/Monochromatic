/**
 * Startup recovery for interrupted private-index commit transactions.
 *
 * @module
 */
import {
  access,
  open,
  readFile,
  realpath,
  rename,
  rm,
} from 'node:fs/promises';
import {
  dirname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import {
  isMissingPath,
  syncDirectory,
} from '../trust/registry-io.ts';
import { snapshotFilesEqual, } from './commit-transaction-candidate-snapshot.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import {
  INDEX_INSTALLED_FILENAME,
  REF_UPDATED_FILENAME,
  resolveCurrentHead,
} from './commit-transaction-journal.ts';
import {
  assertLandedCommit,
  assertOwnedLock,
  CommitTransactionRecoveryError,
  headsEqual,
  parsePreparedJournal,
  parseRefUpdated,
} from './commit-transaction-recovery-validation.ts';
import { TRANSACTION_DIRECTORY_NAME, } from './commit-transaction-workspace.ts';

export { CommitTransactionRecoveryError, } from './commit-transaction-recovery-validation.ts';

/**
 * Strict journal and Git decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 * Recovery action taken at startup.
 */
export type CommitTransactionRecoveryResult =
  | 'none'
  | 'commit-not-created'
  | 'index-installed'
  | 'already-installed';

/**
 * Reports whether path currently exists without suppressing other failures.
 *
 * @param path - exact path to probe
 *
 * @returns whether path is present
 */
async function pathExists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}

/**
 * Reports whether journal owner process is still alive.
 *
 * @param pid - recorded wrapper process ID
 *
 * @returns whether signal-zero probe succeeds
 */
function processIsAlive(pid: number,): boolean {
  try {
    process.kill(
      pid,
      0,
    );
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ESRCH'))
      return false;
    throw error;
  }
}

/**
 * Installs prepared post-index through exact owned lock.
 *
 * @param lockPath - verified lock path
 *
 * @param realIndexPath - journal real index path
 *
 * @param postIndexPath - prepared exact post index
 */
async function installRecoveredIndex({
  lockPath,
  realIndexPath,
  postIndexPath,
}: Readonly<{
  lockPath: string;
  realIndexPath: string;
  postIndexPath: string;
}>,): Promise<void> {
  /**
   * Exact intended post-index bytes.
   */
  const bytes = await readFile(postIndexPath,);
  /**
   * Existing verified owned lock handle.
   */
  await using lock = await open(
    lockPath,
    'r+',
  );
  await lock.truncate(0,);
  await lock.writeFile(bytes,);
  await lock.sync();
  await lock.close();
  await rename(
    lockPath,
    realIndexPath,
  );
  await syncDirectory(dirname(realIndexPath,),);
}

/**
 * Removes completed recovery artifacts durably.
 *
 * @param directory - exact transaction directory
 *
 * @param lockPath - optional owned lock path
 */
async function removeRecoveryArtifacts({
  directory,
  lockPath,
}: Readonly<{
  directory: string;
  lockPath?: string;
}>,): Promise<void> {
  if (lockPath !== undefined)
    await rm(
      lockPath,
      { force: true, },
    );
  await rm(
    directory,
    {
      recursive: true,
      force: true,
    },
  );
  await syncDirectory(dirname(directory,),);
}

/**
 * Recovers interrupted transaction for invocation repository before config execution.
 *
 * @param args - exact wrapper arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @returns recovery action
 *
 * @throws CommitTransactionRecoveryError when current state conflicts
 *
 * @example
 * ```ts
 * await recoverCommitTransaction({ args: ['status'], gitPath: '/usr/bin/git' });
 * ```
 */
export async function recoverCommitTransaction({
  args,
  gitPath,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
}>,): Promise<CommitTransactionRecoveryResult> {
  /**
   * Effective invocation repository location.
   */
  const { effectiveCwd, } = parseGlobalOptions(args,);
  /**
   * Whether cwd belongs to worktree.
   */
  const inside = await runTransactionGit({
    gitPath,
    cwd: effectiveCwd,
    args: [
      'rev-parse',
      '--is-inside-work-tree',
    ],
    allowFailure: true,
  },);
  if ((inside.exitCode !== 0) || (DECODER.decode(inside.stdout,)
    .trim()
    !== 'true'))
    return 'none';
  /**
   * Git-provided transaction directory path.
   */
  const directoryOutput = await runTransactionGit({
    gitPath,
    cwd: effectiveCwd,
    args: [
      'rev-parse',
      '--git-path',
      TRANSACTION_DIRECTORY_NAME,
    ],
  },);
  /**
   * Reported transaction path.
   */
  const reportedDirectory = DECODER.decode(directoryOutput.stdout,)
    .trim();
  /**
   * Absolute transaction directory.
   */
  const directory = isAbsolute(reportedDirectory,)
    ? reportedDirectory
    : resolve(
      effectiveCwd,
      reportedDirectory,
    );
  if (!(await pathExists(directory,)))
    return 'none';
  /**
   * Required prepared journal path.
   */
  const journalPath = join(
    directory,
    'journal.json',
  );
  /**
   * Required exact original index snapshot.
   */
  const originalIndexPath = join(
    directory,
    'original.index',
  );
  /**
   * Required exact intended index snapshot.
   */
  const postIndexPath = join(
    directory,
    'post.index',
  );
  if (!(await Promise.all([
    pathExists(journalPath,),
    pathExists(originalIndexPath,),
    pathExists(postIndexPath,),
  ],)).every(Boolean,))
    throw new CommitTransactionRecoveryError(`Incomplete transaction recovery artifacts: ${directory}`,);
  /**
   * Prepared journal.
   */
  const journal = parsePreparedJournal(
    new Uint8Array(await readFile(journalPath,),),
  );
  if ((journal.ownerPid !== process.pid) && processIsAlive(journal.ownerPid,))
    throw new CommitTransactionRecoveryError(`Transaction owner process ${String(journal.ownerPid,)} is still active: ${directory}`,);
  /**
   * Canonical current repository root.
   */
  const repositoryRoot = await realpath(DECODER.decode((await runTransactionGit({
    gitPath,
    cwd: effectiveCwd,
    args: [
      'rev-parse',
      '--show-toplevel',
    ],
  },)).stdout,)
    .trim(),);
  if (repositoryRoot !== journal.repositoryRoot)
    throw new CommitTransactionRecoveryError('Transaction journal repository identity does not match invocation.',);
  /**
   * Git-provided current index path.
   */
  const reportedIndex = DECODER.decode((await runTransactionGit({
    gitPath,
    cwd: effectiveCwd,
    args: [
      'rev-parse',
      '--git-path',
      'index',
    ],
  },)).stdout,)
    .trim();
  /**
   * Absolute current real index path.
   */
  const realIndexPath = isAbsolute(reportedIndex,)
    ? reportedIndex
    : resolve(
      effectiveCwd,
      reportedIndex,
    );
  if (realIndexPath !== journal.realIndexPath)
    throw new CommitTransactionRecoveryError('Transaction journal index path does not match invocation.',);
  /**
   * Current exact ref state.
   */
  const currentHead = await resolveCurrentHead({
    gitPath,
    cwd: effectiveCwd,
  },);
  /**
   * Whether real index remains exact original bytes.
   */
  const realIsOriginal = await snapshotFilesEqual({
    leftPath: originalIndexPath,
    rightPath: realIndexPath,
  },);
  /**
   * Whether real index already contains intended bytes.
   */
  const realIsIntended = await snapshotFilesEqual({
    leftPath: postIndexPath,
    rightPath: realIndexPath,
  },);
  /**
   * Current lock path.
   */
  const lockPath = `${realIndexPath}.lock`;
  if (headsEqual({
    expected: journal.originalHead,
    current: currentHead,
  })) {
    if (!realIsOriginal)
      throw new CommitTransactionRecoveryError(`Commit did not land but real index changed; recovery retained at ${directory}`,);
    await assertOwnedLock({
      journal,
      lockPath,
    },);
    await removeRecoveryArtifacts({
      directory,
      lockPath,
    },);
    return 'commit-not-created';
  }
  if (currentHead.kind === 'absent')
    throw new CommitTransactionRecoveryError(`HEAD disappeared after prepared transaction; recovery retained at ${directory}`,);
  /**
   * Optional durable landed marker path.
   */
  const markerPath = join(
    directory,
    REF_UPDATED_FILENAME,
  );
  if (await pathExists(markerPath,)) {
    /**
     * Validated durable landed marker.
     */
    const marker = parseRefUpdated(
      new Uint8Array(await readFile(markerPath,),),
    );
    if (marker.landedOid !== currentHead.oid)
      throw new CommitTransactionRecoveryError(`Current HEAD differs from journal landed OID; recovery retained at ${directory}`,);
  }
  await assertLandedCommit({
    gitPath,
    cwd: effectiveCwd,
    oid: currentHead.oid,
    journal,
  },);
  if (realIsIntended) {
    /**
     * Whether installation marker became durable before interruption.
     */
    const installationMarked = await pathExists(join(
      directory,
      INDEX_INSTALLED_FILENAME,
    ),);
    if (await pathExists(lockPath,)) {
      await assertOwnedLock({
        journal,
        lockPath,
      },);
      await rm(lockPath,);
    }
    await removeRecoveryArtifacts({ directory, },);
    return installationMarked ? 'already-installed' : 'index-installed';
  }
  if (!realIsOriginal)
    throw new CommitTransactionRecoveryError(`Real index conflicts with prepared recovery state: ${directory}`,);
  await assertOwnedLock({
    journal,
    lockPath,
  },);
  await installRecoveredIndex({
    lockPath,
    realIndexPath,
    postIndexPath,
  },);
  await removeRecoveryArtifacts({ directory, },);
  return 'index-installed';
}
