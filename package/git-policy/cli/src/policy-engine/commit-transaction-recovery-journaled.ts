/**
 Recovery of one dead-owner transaction whose prepared journal is durable.

 @module
 */
import {
  lstat,
  realpath,
  rm,
} from 'node:fs/promises';
import {
  isAbsolute,
  join,
  resolve,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { snapshotFilesEqual, } from './commit-transaction-candidate-snapshot.ts';
import { installAddedWorktreeFiles, } from './commit-transaction-added-paths.ts';
import { runTransactionGit, } from './commit-transaction-git.ts';
import { createOwnedFileLink, } from './commit-transaction-install-link.ts';
import {
  INDEX_INSTALLED_FILENAME,
  type PreparedTransactionJournal,
  REF_UPDATED_FILENAME,
  resolveCurrentHead,
} from './commit-transaction-journal.ts';
import { recoverNormalization, } from './commit-transaction-normalization-recovery.ts';
import {
  installRecoveredIndex,
  readRegularRecoveryFile,
  recoveryPathExists,
  removeRecoveryArtifacts,
} from './commit-transaction-recovery-files.ts';
import { findTransactionLandedOid, } from './commit-transaction-recovery-reflog.ts';
import {
  assertLandedCommit,
  assertOwnedLock,
  CommitTransactionRecoveryError,
  headsEqual,
  parsePreparedJournal,
  parseRefUpdated,
} from './commit-transaction-recovery-validation.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Strict journal and Git decoder.
 */
const DECODER = new TextDecoder(
  'utf-8',
  { fatal: true, },
);

/**
 Prepared journal filename.
 */
export const JOURNAL_FILENAME = 'journal.json';

/**
 Actions a journaled recovery completes with.
 */
export type JournaledRecoveryAction =
  | 'commit-not-created'
  | 'normalization-installed'
  | 'index-installed'
  | 'already-installed';

/**
 Reads the prepared journal after proving required snapshots exist and the directory is the journaled one.

 @param directory - exact transaction directory

 @returns validated prepared journal

 @throws {@link CommitTransactionRecoveryError} when artifacts are incomplete, malformed, or replaced

 @example
 ```ts
 await loadTransactionJournal('/repo/.git/cli-git-transactions/0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10');
 ```
 */
export async function loadTransactionJournal(directory: string,): Promise<PreparedTransactionJournal> {
  if (!(await Promise.all([
    recoveryPathExists(join(
      directory,
      JOURNAL_FILENAME,
    ),),
    recoveryPathExists(join(
      directory,
      'original.index',
    ),),
    recoveryPathExists(join(
      directory,
      'post.index',
    ),),
  ],)).every(Boolean,))
    throw new CommitTransactionRecoveryError(`Incomplete transaction recovery artifacts: ${directory}`,);
  /**
   Prepared journal read through no-follow descriptor.
   */
  const journal = parsePreparedJournal(
    await readRegularRecoveryFile(join(
      directory,
      JOURNAL_FILENAME,
    ),),
  );
  /**
   Non-followed directory metadata bound into the journal.
   */
  const directoryMetadata = await lstat(
    directory,
    { bigint: true, },
  );
  if ((!directoryMetadata.isDirectory()) || directoryMetadata.isSymbolicLink()
    || (String(directoryMetadata.dev,) !== journal.directoryDevice)
    || (String(directoryMetadata.ino,) !== journal.directoryInode))
    throw new CommitTransactionRecoveryError(`Transaction directory identity changed: ${directory}`,);
  return journal;
}

/**
 Resolves the current real index and proves it and the repository match the journal.

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @param journal - validated prepared journal

 @returns absolute current real index path
 */
async function resolveJournaledIndex({
  gitPath,
  effectiveCwd,
  journal,
}: Readonly<{
  gitPath: string;
  effectiveCwd: string;
  journal: PreparedTransactionJournal;
}>,): Promise<string> {
  /**
   Canonical current repository root.
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
   Git-provided current index path.
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
   Absolute current real index path.
   */
  const realIndexPath = isAbsolute(reportedIndex,)
    ? reportedIndex
    : resolve(
      effectiveCwd,
      reportedIndex,
    );
  if (realIndexPath !== journal.realIndexPath)
    throw new CommitTransactionRecoveryError('Transaction journal index path does not match invocation.',);
  return realIndexPath;
}

/**
 Resolves the commit the transaction landed from its durable marker or, without one, from its reflog nonce.

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @param directory - transaction directory

 @param journal - validated prepared journal

 @returns landed commit OID
 */
async function resolveLandedOid({
  gitPath,
  effectiveCwd,
  directory,
  journal,
}: Readonly<{
  gitPath: string;
  effectiveCwd: string;
  directory: string;
  journal: PreparedTransactionJournal;
}>,): Promise<string> {
  /**
   Optional durable landed marker path.
   */
  const markerPath = join(
    directory,
    REF_UPDATED_FILENAME,
  );
  if (await recoveryPathExists(markerPath,)) {
    /**
     Validated durable landed marker.
     */
    const { landedOid, } = parseRefUpdated(
      await readRegularRecoveryFile(markerPath,),
    );
    return landedOid;
  }
  return findTransactionLandedOid({
    gitPath,
    cwd: effectiveCwd,
    reflogAction: journal.reflogAction,
  },);
}

/**
 Restores, installs, or confirms the real index for one dead-owner journaled transaction.

 @param directory - exact transaction directory

 @param journal - validated prepared journal

 @param gitPath - resolved Git executable

 @param effectiveCwd - invocation repository location

 @returns recovery action

 @throws {@link CommitTransactionRecoveryError} when ref, reflog, index, or lock evidence conflicts

 @example
 ```ts
 await recoverJournaledTransaction({ directory, journal, gitPath: '/usr/bin/git', effectiveCwd: '/repo' });
 ```
 */
export async function recoverJournaledTransaction({
  directory,
  journal,
  gitPath,
  effectiveCwd,
}: Readonly<{
  directory: string;
  journal: PreparedTransactionJournal;
  gitPath: string;
  effectiveCwd: string;
}>,): Promise<JournaledRecoveryAction> {
  /**
   Tagged journaled recovery logger.
   */
  const rl = tagged({
    tag: recoverJournaledTransaction.name,
    l,
  },);
  /**
   Owner-preserving stable original-index path.
   */
  const stableOriginalIndexPath = join(
    directory,
    'original.recovery',
  );
  /**
   Owner-preserving stable post-index path.
   */
  const stablePostIndexPath = join(
    directory,
    'post.recovery',
  );
  await Promise.all([
    createOwnedFileLink({
      sourcePath: join(
        directory,
        'original.index',
      ),
      linkedPath: stableOriginalIndexPath,
      expectedDevice: journal.originalIndexDevice,
      expectedInode: journal.originalIndexInode,
    },),
    createOwnedFileLink({
      sourcePath: join(
        directory,
        'post.index',
      ),
      linkedPath: stablePostIndexPath,
      expectedDevice: journal.postIndexDevice,
      expectedInode: journal.postIndexInode,
    },),
  ],);
  /**
   Current real index proven to be the journaled one.
   */
  const realIndexPath = await resolveJournaledIndex({
    gitPath,
    effectiveCwd,
    journal,
  },);
  /**
   Current exact ref state.
   */
  const currentHead = await resolveCurrentHead({
    gitPath,
    cwd: effectiveCwd,
  },);
  /**
   Whether real index remains exact original bytes.
   */
  const realIsOriginal = await snapshotFilesEqual({
    leftPath: stableOriginalIndexPath,
    rightPath: realIndexPath,
  },);
  /**
   Whether real index already contains intended bytes.
   */
  const realIsIntended = await snapshotFilesEqual({
    leftPath: stablePostIndexPath,
    rightPath: realIndexPath,
  },);
  /**
   Current lock path.
   */
  const lockPath = `${realIndexPath}.lock`;
  /**
   Completion records for added and selected worktree files.
   */
  const worktreeRecords = [
    ...journal.addedPaths,
    ...(journal.selectedWorktreePaths ?? []),
  ];
  if (journal.operation === 'normalize-only')
    return recoverNormalization({
      gitPath,
      cwd: effectiveCwd,
      directory,
      journal,
      currentHead,
      realIndexPath,
      stablePostIndexPath,
      realIsOriginal,
      realIsIntended,
    },);
  if (headsEqual({
    expected: journal.originalHead,
    current: currentHead,
  })) {
    if (!realIsOriginal)
      throw new CommitTransactionRecoveryError(`Commit did not land but real index changed; recovery retained at ${directory}`,);
    // A lock removed after the owner died leaves nothing to release; HEAD and the index still prove nothing landed.
    if (!(await recoveryPathExists(lockPath,))) {
      rl.debug(`owned lock already absent for unlanded transaction ${directory}`,);
      await removeRecoveryArtifacts({ directory, },);
      return 'commit-not-created';
    }
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
   Commit this transaction landed, proven by its marker or reflog nonce.
   */
  const landedOid = await resolveLandedOid({
    gitPath,
    effectiveCwd,
    directory,
    journal,
  },);
  if (landedOid !== currentHead.oid)
    throw new CommitTransactionRecoveryError(`Current HEAD ${currentHead.oid} differs from transaction landed commit ${landedOid}; recovery retained at ${directory}`,);
  await assertLandedCommit({
    gitPath,
    cwd: effectiveCwd,
    oid: currentHead.oid,
    journal,
  },);
  if (realIsIntended) {
    /**
     Whether installation marker became durable before interruption.
     */
    const installationMarked = await recoveryPathExists(join(
      directory,
      INDEX_INSTALLED_FILENAME,
    ),);
    if (await recoveryPathExists(lockPath,)) {
      await assertOwnedLock({
        journal,
        lockPath,
      },);
      await rm(lockPath,);
    }
    await installAddedWorktreeFiles({
      gitPath,
      cwd: effectiveCwd,
      repositoryRoot: journal.repositoryRoot,
      records: worktreeRecords,
    },);
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
  await installAddedWorktreeFiles({
    gitPath,
    cwd: effectiveCwd,
    repositoryRoot: journal.repositoryRoot,
    records: worktreeRecords,
  },);
  await removeRecoveryArtifacts({ directory, },);
  return 'index-installed';
}
