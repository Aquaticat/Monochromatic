import type { AlignedRun, } from './group-aligned.ts';

//region Insertion anchors read off the settled runs
// Where a block the translation never rendered gets written, decided from the
// runs that ship rather than from the walk they were built out of.
//
// WHY THE WALK IS NO LONGER THE AUTHORITY. `anchorOffsets` reads the walk, and
// the walk is a faithful description of the layout right up until
// `mergeOneSidedRuns` folds an unclaimed translation block into a neighbour. A
// run's span is cut from its first node to its last, so absorbing a block
// STRETCHES the span over it, and an anchor that named that block's start is
// then pointing into the middle of a passage rather than at a boundary
// between two.
//
// `assertPlacementLayout` catches it and refuses the document: 431 of 910
// randomised reader-legal pairings over the pinned corpus, and 689 of 4000
// over synthetic ones, all of them with a message about one slice starting
// before the one before it ends.
//
// THE SMALLEST CASE IS TWO PARAGRAPHS AGAINST TWO. Pair only the first, and
// the second original becomes an insertion anchored at the second
// translation's start, while that same translation folds into the first
// run. The anchor and the span then describe the same bytes.
//
// FORWARD FIRST, which keeps the meaning `anchorOffsets` gave it: the missing
// rendering belongs immediately BEFORE the passage that follows, not after the
// one behind. Only when nothing follows does the boundary become the end of
// what came before, which is where a page whose closing passages were never
// rendered needs them written.

/**
 * Stands for "no boundary on this side", which no offset can be.
 */
const NO_BOUNDARY = -1;

/**
 * Reads, for each run, where the nearest translation blocks AFTER it start.
 *
 * @param runs - settled runs in document order
 *
 * @returns Offset per run, {@link NO_BOUNDARY} where nothing follows
 *
 * @example
 * ```ts
 * const starts = nextTargetStarts({ runs, },);
 * ```
 */
function nextTargetStarts(
  { runs, }: { readonly runs: readonly AlignedRun[]; },
): readonly number[] {
  /**
   * Nearest start seen while walking backwards, one named record rather than a
   * loose counter.
   */
  const scan = { next: NO_BOUNDARY, };
  return runs
    .toReversed()
    .map(function toNextStart(run,): number {
      /**
       * Answer for this run, read before its own blocks can overwrite it.
       */
      const answer = scan.next;

      /**
       * First translation block this run carries, absent for an insertion.
       */
      const first = (run.kind === 'paired')
        ? run.targetRun[0]
        : undefined;
      if (first !== undefined)
        scan.next = first.startOffset;
      return answer;
    },)
    .toReversed();
}

/**
 * Reads, for each run, where the nearest translation blocks BEFORE it end.
 *
 * @param runs - settled runs in document order
 *
 * @returns Offset per run, {@link NO_BOUNDARY} where nothing precedes
 *
 * @example
 * ```ts
 * const ends = previousTargetEnds({ runs, },);
 * ```
 */
function previousTargetEnds(
  { runs, }: { readonly runs: readonly AlignedRun[]; },
): readonly number[] {
  /**
   * Nearest end seen while walking forwards.
   */
  const scan = { previous: NO_BOUNDARY, };
  return runs.map(function toPreviousEnd(run,): number {
    /**
     * Answer for this run, read before its own blocks can overwrite it.
     */
    const answer = scan.previous;

    /**
     * Last translation block this run carries, absent for an insertion.
     */
    const last = (run.kind === 'paired')
      ? run.targetRun
        .at(-1,)
      : undefined;
    if (last !== undefined)
      scan.previous = last.endOffset;
    return answer;
  },);
}

/**
 * Rewrites every insertion's anchor as a boundary between the runs beside it.
 *
 * @param runs - settled runs in document order
 *
 * @returns Same runs, each insertion anchored where it can actually be written
 *
 * @example
 * ```ts
 * const placeable = reanchorInsertions({ runs, },);
 * ```
 */
export function reanchorInsertions(
  { runs, }: { readonly runs: readonly AlignedRun[]; },
): readonly AlignedRun[] {
  /**
   * Where the next translation blocks start, per run.
   */
  const nextStart = nextTargetStarts({ runs, },);

  /**
   * Where the previous translation blocks end, per run.
   */
  const previousEnd = previousTargetEnds({ runs, },);
  return runs.map(function toAnchored(
    run,
    at,
  ): AlignedRun {
    if (run.kind !== 'insertion')
      return run;

    /**
     * Boundary this insertion writes at, preferring the passage that follows.
     */
    const settled = (nextStart[at] ?? NO_BOUNDARY) === NO_BOUNDARY
      ? (previousEnd[at] ?? NO_BOUNDARY)
      : (nextStart[at] ?? NO_BOUNDARY);

    // NOTHING EITHER SIDE CARRIES A TRANSLATION BLOCK, so there is no boundary
    // to read and the walk's answer is the only one there is. `anchorOffsets`
    // returns nothing at all when no step paired, so this is unreachable
    // through it; keeping the run untouched is the honest reading if it ever is.
    return (settled === NO_BOUNDARY)
      ? run
      : {
        kind: 'insertion',
        sourceRun: run.sourceRun,
        targetOffset: settled,
      };
  },);
}

//endregion Insertion anchors read off the settled runs
