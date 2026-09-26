import { rm, } from 'node:fs/promises';

import {
  createWorktreeCopyJournal,
  type PendingWorktreeCopyJournal,
} from './journal.ts';
import type {
  CreatedWorktree,
  StagedWorktreeSnapshot,
  WorktreeCopySummary,
} from './model.ts';
import { stageIgnoredSnapshot, } from './snapshot.ts';
import { completeJournal, } from './transaction-install.ts';

/**
 Creates transaction journal or removes unowned stage after journal failure.
 
 @param commonDir - canonical common Git directory
 
 @param destinationRoot - newly created worktree root
 
 @param snapshot - validated staged snapshot
 
 @returns durable transaction journal
 
 @example
 ```ts
 await createJournalOrCleanup({ commonDir, destinationRoot, snapshot });
 ```
 */
async function createJournalOrCleanup({
  commonDir,
  destinationRoot,
  snapshot,
}: Readonly<{
  commonDir: string;
  destinationRoot: string;
  snapshot: StagedWorktreeSnapshot;
}>,): Promise<PendingWorktreeCopyJournal> {
  try {
    return await createWorktreeCopyJournal({
      commonDir,
      destinationRoot,
      snapshot,
    },);
  }
  catch (error: unknown) {
    await rm(
      snapshot.stageContainer,
      {
        recursive: true,
        force: true,
      },
    );
    throw error;
  }
}

/**
 Synchronizes ignored source state into one newly registered worktree.
 
 @param commonDir - canonical common Git directory
 
 @param sourceRoot - canonical source worktree
 
 @param destinationRoot - canonical created worktree
 
 @param registeredRoots - every registered root excluded from recursive copy
 
 @param gitPath - absolute real-Git executable
 
 @returns newly installed selected entry count

 @throws {@link WorktreeCopyError} after rollback, once the failed transaction's journal and stage are removed
 
 @example
 ```ts
 await synchronizeCreatedWorktree({ commonDir, sourceRoot, destinationRoot, registeredRoots, gitPath });
 ```
 */
async function synchronizeCreatedWorktree({
  commonDir,
  sourceRoot,
  destinationRoot,
  registeredRoots,
  gitPath,
}: Readonly<{
  commonDir: string;
  sourceRoot: string;
  destinationRoot: string;
  registeredRoots: readonly string[];
  gitPath: string;
}>,): Promise<number> {
  /**
   Validated private ignored-state snapshot.
   */
  const snapshot = await stageIgnoredSnapshot({
    sourceRoot,
    destinationRoot,
    registeredRoots,
    gitPath,
  },);
  /**
   Durable staged transaction journal.
   */
  const pending = await createJournalOrCleanup({
    commonDir,
    destinationRoot,
    snapshot,
  },);
  /**
   Installation outcome; its journal and stage are gone either way.
   */
  const outcome = await completeJournal({
    pending,
    snapshot: async function stagedSnapshot() {
      return snapshot;
    },
  },);
  if (outcome.kind === 'ended')
    throw outcome.failure;
  return outcome.copiedEntries;
}

/**
 Synchronizes ignored source state into every created worktree.
 
 @param commonDir - canonical common Git directory
 
 @param sourceRoot - canonical source worktree, absent for bare repository
 
 @param created - newly registered linked worktrees
 
 @param registeredRoots - all registered roots excluded from source recursion
 
 @param gitPath - absolute real-Git executable
 
 @returns aggregate success summary
 
 @example
 ```ts
 await synchronizeCreatedWorktrees({ commonDir, sourceRoot: '/repo', created, registeredRoots, gitPath });
 ```
 */
export async function synchronizeCreatedWorktrees({
  commonDir,
  sourceRoot,
  created,
  registeredRoots,
  gitPath,
}: Readonly<{
  commonDir: string;
  sourceRoot?: string;
  created: readonly CreatedWorktree[];
  registeredRoots: readonly string[];
  gitPath: string;
}>,): Promise<WorktreeCopySummary> {
  if (sourceRoot === undefined) {
    return {
      copiedEntries: 0,
      destinationCount: created.length,
    };
  }
  /**
   Newly installed selected entry counts per destination.
   */
  const copiedCounts: number[] = [];
  for (const destination of created) {
    // oxlint-disable-next-line no-await-in-loop -- destination transactions remain isolated and deterministic
    copiedCounts.push(await synchronizeCreatedWorktree({
      commonDir,
      sourceRoot,
      destinationRoot: destination.root,
      registeredRoots,
      gitPath,
    },),);
  }
  /**
   Aggregate newly installed selected entry count.
   */
  const copiedEntries = copiedCounts.reduce(
    function addCount(
      total,
      count,
    ): number {
    return total + count;
  },
    0,
  );
  return {
    copiedEntries,
    destinationCount: created.length,
    sourceRoot,
  };
}
