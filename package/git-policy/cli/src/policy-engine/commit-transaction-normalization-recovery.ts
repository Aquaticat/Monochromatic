//region Normalization-only recovery
/**
 Recovers an index and worktree correction that deliberately created no commit.

 @module
 */
import {
  lstat,
  rm,
} from 'node:fs/promises';
import { isMissingPath, } from '../trust/registry-io.ts';
import { installAddedWorktreeFiles, } from './commit-transaction-added-paths.ts';
import {
  installRecoveredIndex,
  removeRecoveryArtifacts,
} from './commit-transaction-recovery-files.ts';
import {
  CommitTransactionRecoveryError,
  headsEqual,
  assertOwnedLock,
} from './commit-transaction-recovery-validation.ts';
import type {
  OriginalHead,
  PreparedTransactionJournal,
} from './commit-transaction-journal.ts';

/**
 Tests lock presence without treating unrelated filesystem errors as absence.

 @param path - exact index lock path

 @returns whether an entry exists
 */
async function lockExists(path: string,): Promise<boolean> {
  try {
    await lstat(path,);
    return true;
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return false;
    throw error;
  }
}

/**
 Resumes selected-file reconciliation when HEAD deliberately stayed unchanged.

 @param gitPath - real Git executable

 @param cwd - effective Git directory

 @param directory - owned transaction directory

 @param journal - validated normalization-only intent

 @param currentHead - current HEAD identity

 @param realIndexPath - current Git index

 @param stablePostIndexPath - verified intended index snapshot

 @param realIsOriginal - current index equals pre-fix snapshot

 @param realIsIntended - current index equals intended snapshot

 @returns normalization-installed recovery action

 @example
 ```ts
 await recoverNormalization({ gitPath, cwd, directory, journal, currentHead, realIndexPath, stablePostIndexPath, realIsOriginal: true, realIsIntended: false });
 ```
 */
export async function recoverNormalization({
  gitPath,
  cwd,
  directory,
  journal,
  currentHead,
  realIndexPath,
  stablePostIndexPath,
  realIsOriginal,
  realIsIntended,
}: Readonly<{
  gitPath: string;
  cwd: string;
  directory: string;
  journal: PreparedTransactionJournal;
  currentHead: OriginalHead;
  realIndexPath: string;
  stablePostIndexPath: string;
  realIsOriginal: boolean;
  realIsIntended: boolean;
}>,): Promise<'normalization-installed'> {
  if ((!headsEqual({
    expected: journal.originalHead,
    current: currentHead,
  },)) || ((!realIsOriginal) && (!realIsIntended)))
    throw new CommitTransactionRecoveryError(`Normalization-only transaction conflicts with HEAD or index; recovery retained at ${directory}`,);
  /**
   Lock whose identity is bound to prepared journal when still present.
   */
  const lockPath = `${realIndexPath}.lock`;
  if (!realIsIntended) {
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
  }
  else if (await lockExists(lockPath,)) {
    await assertOwnedLock({
      journal,
      lockPath,
    },);
    await rm(lockPath,);
  }
  await installAddedWorktreeFiles({
    gitPath,
    cwd,
    repositoryRoot: journal.repositoryRoot,
    records: [
      ...journal.addedPaths,
      ...(journal.selectedWorktreePaths ?? []),
    ],
  },);
  await removeRecoveryArtifacts({ directory, },);
  return 'normalization-installed';
}
//endregion Normalization-only recovery
