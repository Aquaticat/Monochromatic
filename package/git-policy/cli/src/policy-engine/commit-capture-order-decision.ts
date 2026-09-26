/**
 Capture-order decisions of replay
 (owner decision 2026-09-26,
 `doc/decision/cli-git-concurrent-commits.md` "Implementation-time decisions").

 For a path that both the prepared commit and the commits landed since its preparation base changed,
 when the prepared commit captured the path's bytes from this worktree
 and every landed commit that changed the path captured it from this worktree too,
 the later capture's bytes land:
 a prepared commit captured later lands its own entry,
 and one captured earlier keeps the landed entry.
 This records what native sequential commits would record from the shared disk.
 Every other path keeps subsumption,
 then the three-way merge.

 @module
 */
import type { LandedChange, } from './commit-capture-order-history.ts';
import type { CaptureStamp, } from './commit-capture-order-store.ts';

/**
 One capture with its worktree-captured paths as a set, Latin-1 decoded.
 */
export type CaptureView = CaptureStamp & Readonly<{
  /**
   Paths whose bytes the capture read from the worktree.
   */
  paths: ReadonlySet<string>;
}>;

/**
 Builds a capture view from a record's path list.

 @param stamp - capture stamp

 @param worktreePaths - recorded worktree-captured paths

 @returns view

 @example
 ```ts
 captureView({ stamp: { worktreeId: 'w', sequence: 1 }, worktreePaths: ['a'] });
 ```
 */
export function captureView({
  stamp,
  worktreePaths,
}: Readonly<{
  stamp: CaptureStamp;
  worktreePaths: readonly string[];
}>,): CaptureView {
  return {
    worktreeId: stamp.worktreeId,
    sequence: stamp.sequence,
    paths: new Set(worktreePaths,),
  };
}

/**
 Capture-order decision for one shared path.
 */
export type CaptureOrderDecision =
  /**
   The prepared commit captured later: its entry lands.
   */
  | 'prepared'
  /**
   A landed commit captured later: the landed entry stays.
   */
  | 'landed'
  /**
   Capture order does not apply: subsumption, then the three-way merge.
   */
  | 'unordered';

/**
 Decides one shared path.

 @param path - shared path, Latin-1 decoded

 @param captured - prepared commit's capture

 @param history - commits landed since the preparation base with their changed paths

 @param landed - landed captures by commit

 @returns decision

 @example
 ```ts
 decideCaptureOrder({ path: 'a.txt', captured, history, landed }); // 'prepared'
 ```
 */
export function decideCaptureOrder({
  path,
  captured,
  history,
  landed,
}: Readonly<{
  path: string;
  captured: CaptureView;
  history: readonly LandedChange[];
  landed: ReadonlyMap<string, CaptureView>;
}>,): CaptureOrderDecision {
  if (!captured.paths
    .has(path,))
    return 'unordered';
  /**
   Landed commits that changed the path.
   */
  const touching = history.filter(function changes(change,): boolean {
    return change.paths
      .has(path,);
  },);
  /**
   Their captures of the path from this worktree; a commit without one leaves the list shorter.
   */
  const ordered = touching.flatMap(function captureOf(change,): readonly CaptureView[] {
    /**
     Record of the commit.
     */
    const record = landed.get(change.commit,);
    return (record !== undefined)
      && (record.worktreeId === captured.worktreeId)
      && record.paths
      .has(path,) ? [record,] : [];
  },);
  if ((touching.length === 0) || (ordered.length !== touching.length))
    return 'unordered';
  /**
   Latest landed capture of the path.
   */
  const latest = Math.max(...ordered.map(function sequenceOf(record,): number {
    return record.sequence;
  },),);
  return captured.sequence > latest ? 'prepared' : 'landed';
}
