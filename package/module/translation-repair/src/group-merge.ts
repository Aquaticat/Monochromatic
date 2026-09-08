import type { DocumentNode, } from './document-node.ts';
import type {
  GroupedRun,
  SealedRun,
} from './group-aligned.ts';

//region One-sided run merging
// Folds the one-sided runs the walk leaves behind into their neighbours, split
// out of `group-aligned.ts` at its line budget on the seam between WALKING
// steps into runs and SETTLING which run a stray block belongs to. What
// survives there is the walk and the seal; what moved here is everything that
// happens once the runs exist and some of them have an empty side.

/**
 * Mutable run under construction, plus the character counts deciding when it
 * closes.
 */
export type OpenRun = {
  /**
   * Original-side blocks gathered so far.
   */
  readonly sourceRun: DocumentNode[];

  /**
   * Translation-side blocks gathered so far.
   */
  readonly targetRun: DocumentNode[];

  /**
   * Where this run's rendering belongs when it holds only unplaced originals,
   * or {@link NOT_AN_INSERTION} when it is an ordinary run.
   */
  readonly anchor: number;

  /**
   * Whether this run holds sealed blocks, which no neighbour may join.
   */
  readonly sealed: boolean;
};

/**
 * Anchor value for a run that is not an insertion, which no document offset can
 * collide with.
 */
export const NOT_AN_INSERTION = -1;

/**
 * Where a sealed run ends in the translation, which is where originals held
 * behind it are written.
 *
 * @param run - sealed run
 *
 * @returns End offset of its last block
 *
 * @example
 * ```ts
 * const boundary = sealedEnd({ run, },);
 * ```
 */
function sealedEnd(
  { run, }: { readonly run: SealedRun; },
): number {
  /**
   * Last sealed block, present because a sealed run is built from at least one.
   */
  const last = run.targetRun
    .at(-1,);
  if (last === undefined)
    throw new Error('unreachable: a sealed run always carries at least one translation block',);
  return last.endOffset;
}

/**
 * Places blocks held from one-sided runs, never emitting a run with an empty
 * side and never dropping one.
 *
 * TWO SIDES MAKE A SLICE AND ONE SIDE FOLDS. Held blocks on both sides are a
 * reviewable slice of their own. A single side is not: `runToChunk` builds a
 * span from a run's first and last node, so a run with an empty side has no
 * span and throws. Dropping it instead is the opposite failure, and it defeats
 * `declinedTargetIds` refusing to decline a block precisely so it stays in
 * review.
 *
 * THE TWO SIDES FOLD DIFFERENTLY, because an insertion run carries originals
 * and a translation OFFSET rather than translation blocks. Held translations
 * may fold back past an insertion, which contributes none of them. Held
 * originals may not: that insertion's own originals sit between, so reaching
 * past them would report the two groups out of document order. They join the
 * insertion instead, which is where the nearest place for a rendering is.
 *
 * NEITHER SIDE FOLDS PAST A SEAL. A held translation looks for a host after
 * the last sealed run, since folding it backwards would stretch a span over
 * the sealed bytes; held originals behind a sealed run become an insertion
 * written at the seal's end, which is the page shape a footnote definition
 * after a sealed letter needs.
 *
 * @param merged - runs settled so far, extended in place
 *
 * @param heldSource - original blocks waiting for somewhere to go, emptied here
 *
 * @param heldTarget - translation-side counterpart, emptied here
 *
 * @example
 * ```ts
 * placeHeldRuns({ merged, heldSource, heldTarget, },);
 * ```
 */
function placeHeldRuns(
  {
    merged,
    heldSource,
    heldTarget,
  }: {
    readonly merged: GroupedRun[];
    readonly heldSource: DocumentNode[];
    readonly heldTarget: DocumentNode[];
  },
): void {
  if ((heldSource.length === 0) && (heldTarget.length === 0))
    return;
  if ((heldSource.length > 0) && (heldTarget.length > 0)) {
    merged.push({
      kind: 'paired',
      sourceRun: [ ...heldSource, ],
      targetRun: [ ...heldTarget, ],
    },);
    heldSource.length = 0;
    heldTarget.length = 0;
    return;
  }

  /**
   * Last sealed run, which no held block folds past.
   */
  const lastSealedAt = merged.findLastIndex(function isSealed(candidate,): boolean {
    return candidate.kind === 'sealed';
  },);

  /**
   * Where the held blocks fold, before the last position when only
   * translations are held and an insertion closed the list.
   */
  const at = (heldTarget.length > 0)
    ? merged.findLastIndex(function isPaired(candidate,): boolean {
      return candidate.kind === 'paired';
    },)
    : merged.length - 1;

  /**
   * Run absorbing them, absent when nothing settled yet can carry them, which
   * leaves them held for a later run or for the caller's one-sided fallback.
   */
  const host = merged[at];
  if ((host === undefined) || (at < lastSealedAt))
    return;
  if (host.kind === 'sealed') {
    // ORIGINALS BEHIND A SEAL: the seal's end is the boundary their rendering
    // belongs at, and a run of their own is what keeps them out of its span.
    merged.push({
      kind: 'insertion',
      sourceRun: [ ...heldSource, ],
      targetOffset: sealedEnd({ run: host, },),
    },);
    heldSource.length = 0;
    return;
  }
  merged[at] = (host.kind === 'paired')
    ? {
      kind: 'paired',
      sourceRun: [
        ...host.sourceRun,
        ...heldSource,
      ],
      targetRun: [
        ...host.targetRun,
        ...heldTarget,
      ],
    }
    : {
      kind: 'insertion',
      sourceRun: [
        ...host.sourceRun,
        ...heldSource,
      ],
      targetOffset: host.targetOffset,
    };
  heldSource.length = 0;
  heldTarget.length = 0;
}

/**
 * Folds runs that ended up with nothing on one side into a neighbour, EXCEPT
 * the ones holding originals nothing rendered, and EXCEPT across a seal.
 *
 * A run of purely unpartnered TRANSLATION blocks has no original to compare
 * against and nothing to write, so it joins the run beside it rather than
 * becoming a slice nobody can review. It merges backwards when a previous run
 * exists and forwards otherwise, which keeps a leading run of skips attached to
 * the first reviewable slice.
 *
 * A run of unplaced ORIGINALS is the opposite case and `#100` landing 4 stops
 * folding it. Those blocks have something to write and nowhere yet to write it;
 * folding them into a neighbour puts them inside that slice's span, where no
 * later stage can tell them apart from the passage they were folded into.
 *
 * A SEALED RUN stands where it is: nothing folds into it and it folds into
 * nothing, and the runs either side of it never meet.
 *
 * @param runs - runs as grouped, possibly one-sided
 *
 * @returns Runs that all carry blocks on both sides, sealed runs among them
 *
 * @example
 * ```ts
 * const usable = mergeOneSidedRuns({ runs, },);
 * ```
 */
export function mergeOneSidedRuns(
  { runs, }: { readonly runs: readonly OpenRun[]; },
): readonly GroupedRun[] {
  /**
   * Runs that carry both sides, each replaced wholesale when it absorbs a
   * one-sided neighbour so no run is ever mutated in place.
   */
  const merged: GroupedRun[] = [];

  /**
   * Blocks from leading one-sided runs, waiting for the first run that can
   * carry them.
   */
  const heldSource: DocumentNode[] = [];

  /**
   * Translation-side counterpart of the held blocks.
   */
  const heldTarget: DocumentNode[] = [];
  for (const run of runs) {
    if (run.sealed) {
      // A SEALED RUN STANDS ALONE, like an insertion: held blocks settle ahead
      // of it, since they precede it in the document, and it takes nothing.
      placeHeldRuns({
        merged,
        heldSource,
        heldTarget,
      },);
      merged.push({
        kind: 'sealed',
        sourceRun: [ ...run.sourceRun, ],
        targetRun: [ ...run.targetRun, ],
      },);
      continue;
    }
    if (run.anchor !== NOT_AN_INSERTION) {
      // An insertion run stands alone by construction: it carries originals and
      // the place their rendering goes, so there is nothing to fold it into and
      // nothing it needs from a neighbour. Held blocks still settle ahead of it,
      // since they precede it in the document.
      //
      // THIS USED TO SETTLE THEM ON EITHER SIDE BEING NON-EMPTY, which emitted
      // a `paired` run with nothing on one side and threw in `runToChunk`. It
      // reached 123 of 910 randomised reader-legal pairings over the corpus.
      placeHeldRuns({
        merged,
        heldSource,
        heldTarget,
      },);
      merged.push({
        kind: 'insertion',
        sourceRun: [ ...run.sourceRun, ],
        targetOffset: run.anchor,
      },);
      continue;
    }

    /**
     * Whether this run can stand as a slice of its own.
     */
    const twoSided = (run.sourceRun
      .length
      > 0)
      && (run.targetRun
        .length
        > 0);

    /**
     * Previous complete run, which absorbs a one-sided run when one exists.
     */
    const previous = merged.at(-1,);
    if ((!twoSided)
      && (previous !== undefined)
      && (previous.kind === 'paired')) {
      merged[merged.length - 1] = {
        kind: 'paired',
        sourceRun: [
          ...previous.sourceRun,
          ...run.sourceRun,
        ],
        targetRun: [
          ...previous.targetRun,
          ...run.targetRun,
        ],
      };
      continue;
    }
    if (!twoSided) {
      heldSource.push(...run.sourceRun,);
      heldTarget.push(...run.targetRun,);
      continue;
    }

    // Held blocks have no earlier neighbour, so they prepend to this run.
    merged.push({
      kind: 'paired',
      sourceRun: [
        ...heldSource,
        ...run.sourceRun,
      ],
      targetRun: [
        ...heldTarget,
        ...run.targetRun,
      ],
    },);
    heldSource.length = 0;
    heldTarget.length = 0;
  }

  // ANYTHING STILL HELD BELONGS TO A SECTION WHOSE RUNS WERE ALL ONE-SIDED,
  // which is NOT the same as a section with an empty side. The caller only
  // reaches here when both sides carry blocks, so this is what a supplied
  // pairing that pairs nothing produces once the budget splits the unpaired
  // blocks into separate runs: source-only and target-only runs, alternating,
  // and never a two-sided one to settle into.
  //
  // Discarding them dropped the whole section. It was silent, because every
  // later reader works from the runs, and it took `assertSliceCoverage` to see
  // it: 10 of 920 randomised in-range pairings over the corpus lost a section
  // this way.
  //
  // A ONE-SIDED REMAINDER USED TO BE DROPPED HERE TOO, on the reasoning that a
  // one-sided run is a slice nobody can review. So it is, but folding it into
  // a settled run keeps its blocks in review, and dropping them defeated
  // `declinedTargetIds`, which declines nothing unless the pairing placed every
  // original precisely so an unclaimed translation stays. 534 of 3000
  // randomised reader-legal pairings lost a block this way, and
  // `assertSliceCoverage` then refused the document.
  //
  // The module's stated exception survives as the case `placeHeldRuns` cannot
  // settle: a section with no two-sided run at all leaves the blocks held and
  // returns without them, which is the caller's one-sided fallback.
  placeHeldRuns({
    merged,
    heldSource,
    heldTarget,
  },);
  return merged;
}

//endregion One-sided run merging
