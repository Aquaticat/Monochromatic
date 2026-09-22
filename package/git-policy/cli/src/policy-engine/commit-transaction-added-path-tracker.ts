/**
 Bookkeeping for tracked paths policies add during convergence, shared by commit transactions and direct fix.

 @module
 */
import type { AddedPathRecord, } from './commit-transaction-added-paths.ts';
import { loadIndexEntries, } from './commit-transaction-candidate-batch.ts';

/**
 Added path verified unchanged, before its settled blob is known.
 */
export type PendingAddedPath = Omit<AddedPathRecord, 'intendedOid'>;

/**
 Selected paths plus the tracked paths policies added so far.
 */
export type AddedPathTracker = Readonly<{
  /**
   Records paths a pass added; a path already recorded keeps its first verification.
   */
  record: (added: readonly PendingAddedPath[]) => void;
  /**
   Lists selected paths followed by added paths that were not selected.
   */
  candidatePaths: () => readonly string[];
  /**
   Lists recorded added paths in first-added order.
   */
  pending: () => readonly PendingAddedPath[];
}>;

/**
 Creates added-path bookkeeping over a fixed selection.

 @param selectedPaths - paths the caller selected before any policy ran

 @returns tracker whose candidate paths grow as passes add tracked paths

 @example
 ```ts
 const tracker = createAddedPathTracker(['version.txt']);
 tracker.candidatePaths();
 // => ['version.txt']
 ```
 */
export function createAddedPathTracker(selectedPaths: readonly string[],): AddedPathTracker {
  /**
   Added paths keyed by path, in first-added order.
   */
  const addedPaths = new Map<string, PendingAddedPath>();
  return {
    record: function recordAddedPaths(added,) {
      added.forEach(function recordAddedPath(entry,) {
        if (!addedPaths.has(entry.path,)) {
          addedPaths.set(
            entry.path,
            entry,
          );
        }
      },);
    },
    candidatePaths: function listCandidatePaths() {
      return [
        ...selectedPaths,
        ...[...addedPaths.keys(),].filter(function notSelected(path,) {
          return !selectedPaths.includes(path,);
        },),
      ];
    },
    pending: function listPendingAddedPaths() {
      return [...addedPaths.values(),];
    },
  };
}

/**
 Reads the settled private-index blob of each added path.

 @param gitPath - resolved real Git executable

 @param cwd - repository directory

 @param indexPath - private index holding converged bytes

 @param pending - added paths recorded during convergence

 @returns added paths with the blobs their worktree copies receive

 @throws TypeError when an added path left the private index or changed mode

 @example
 ```ts
 await settleAddedPathRecords({ gitPath: '/usr/bin/git', cwd: '/repo', indexPath: '/tmp/index', pending: [] });
 ```
 */
export async function settleAddedPathRecords({
  gitPath,
  cwd,
  indexPath,
  pending,
}: Readonly<{
  gitPath: string;
  cwd: string;
  indexPath: string;
  pending: readonly PendingAddedPath[];
}>,): Promise<readonly AddedPathRecord[]> {
  /**
   Settled private-index entries for added paths.
   */
  const entries = await loadIndexEntries({
    gitPath,
    cwd,
    indexPath,
    paths: pending.map(function addedPath(added,) {
      return added.path;
    },),
  },);
  return pending.map(function withIntendedOid(added,): AddedPathRecord {
    /**
     Settled private-index entry.
     */
    const entry = entries.get(added.path,);
    if ((entry === undefined) || (entry.modeText !== added.gitMode))
      throw new TypeError(`Policy-added path ${added.path} left the private index or changed mode before commit.`,);
    return {
      ...added,
      intendedOid: entry.oid,
    };
  },);
}
