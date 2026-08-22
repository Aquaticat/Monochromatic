/**
 * Startup recovery for interrupted private-index commit transactions.
 *
 * @module
 */
import {
  access,
  lstat,
  realpath,
  rm,
} from 'node:fs/promises';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import type { GitWorktreeIdentity, } from '../git-worktree-identity.ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';
import { isMissingPath, } from '../trust/registry-io.ts';
import { snapshotFilesEqual, } from './commit-transaction-candidate-snapshot.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';
import {
  PROCESS_IDENTITY_ABSENT,
  resolveProcessBirthIdentity,
} from './commit-transaction-process-identity.ts';
import {
  installRecoveredIndex,
  readRegularRecoveryFile,
  removeRecoveryArtifacts,
} from './commit-transaction-recovery-files.ts';
import {
  INDEX_INSTALLED_FILENAME,
  REF_UPDATED_FILENAME,
  resolveCurrentHead,
} from './commit-transaction-journal.ts';
import {
  RECOVERY_TARGET_NOT_APPLICABLE,
  resolveCommitTransactionDirectory,
} from './commit-transaction-recovery-target.ts';
import {
  assertLandedCommit,
  assertOwnedLock,
  assertTransactionReflog,
  CommitTransactionRecoveryError,
  headsEqual,
  parsePreparedJournal,
  parseRefUpdated,
} from './commit-transaction-recovery-validation.ts';
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
 * Recovers interrupted transaction for invocation repository before config execution.
 *
 * @param args - exact wrapper arguments
 *
 * @param gitPath - resolved real Git executable
 *
 * @param identity - optional repository identity retained by config-free forwarding
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
  identity,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
  identity?: GitWorktreeIdentity;
}>,): Promise<CommitTransactionRecoveryResult> {
  /** Absolute invocation-specific transaction directory when one can exist. */
  const directory = await resolveCommitTransactionDirectory({
    args,
    gitPath,
    ...(identity === undefined ? {} : { identity, }),
  },);
  if (directory === RECOVERY_TARGET_NOT_APPLICABLE)
    return 'none';
  /** Effective invocation cwd retained for journal verification Git requests. */
  const { effectiveCwd, } = parseGlobalOptions(args,);
  if (!(await pathExists(directory,)))
    return 'none';
  /**
   * Non-followed transaction directory metadata.
   */
  const directoryMetadata = await lstat(
    directory,
    { bigint: true, },
  );
  if ((!directoryMetadata.isDirectory()) || directoryMetadata.isSymbolicLink())
    throw new CommitTransactionRecoveryError(`Unsafe transaction recovery directory: ${directory}`,);
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
   * Prepared journal read through no-follow descriptor.
   */
  const journal = parsePreparedJournal(
    await readRegularRecoveryFile(journalPath,),
  );
  if ((String(directoryMetadata.dev,) !== journal.directoryDevice)
    || (String(directoryMetadata.ino,) !== journal.directoryInode))
    throw new CommitTransactionRecoveryError(`Transaction directory identity changed: ${directory}`,);
  /**
   * Owner-preserving stable original-index path.
   */
  const stableOriginalIndexPath = join(
    directory,
    'original.recovery',
  );
  /**
   * Owner-preserving stable post-index path.
   */
  const stablePostIndexPath = join(
    directory,
    'post.recovery',
  );
  await Promise.all([
    createOwnedFileLink({
      sourcePath: originalIndexPath,
      linkedPath: stableOriginalIndexPath,
      expectedDevice: journal.originalIndexDevice,
      expectedInode: journal.originalIndexInode,
    },),
    createOwnedFileLink({
      sourcePath: postIndexPath,
      linkedPath: stablePostIndexPath,
      expectedDevice: journal.postIndexDevice,
      expectedInode: journal.postIndexInode,
    },),
  ],);
  if (processIsAlive(journal.ownerPid,)) {
    /**
     * Current process birth identity for recorded PID.
     */
    const currentOwnerIdentity = await resolveProcessBirthIdentity(journal.ownerPid,);
    if ((typeof currentOwnerIdentity) === 'symbol') {
      if (currentOwnerIdentity !== PROCESS_IDENTITY_ABSENT)
        throw new CommitTransactionRecoveryError('Unknown transaction owner identity state.',);
      throw new CommitTransactionRecoveryError(`Transaction owner identity is unavailable for active PID ${String(journal.ownerPid,)}: ${directory}`,);
    }
    if (currentOwnerIdentity === journal.ownerIdentity)
      throw new CommitTransactionRecoveryError(`Transaction owner process ${String(journal.ownerPid,)} is still active: ${directory}`,);
  }
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
    leftPath: stableOriginalIndexPath,
    rightPath: realIndexPath,
  },);
  /**
   * Whether real index already contains intended bytes.
   */
  const realIsIntended = await snapshotFilesEqual({
    leftPath: stablePostIndexPath,
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
      await readRegularRecoveryFile(markerPath,),
    );
    if (marker.landedOid !== currentHead.oid)
      throw new CommitTransactionRecoveryError(`Current HEAD differs from journal landed OID; recovery retained at ${directory}`,);
  }
  else {
    await assertTransactionReflog({
      gitPath,
      cwd: effectiveCwd,
      oid: currentHead.oid,
      journal,
    },);
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
    postIndexPath: stablePostIndexPath,
    journal,
  },);
  await removeRecoveryArtifacts({ directory, },);
  return 'index-installed';
}
