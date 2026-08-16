import type { DocumentDisplacement, } from '../displacement-class.ts';

//region Window trial draw
// Which slices the window trial buys, and under what label.
//
// TWO JOBS, and the second is the one that makes the first mean anything.
// Flagged slices come from the displacement screen. Matched UNFLAGGED slices
// come from the same documents, and without them a wide arm that keeps the
// archive more often everywhere would read as the window working on
// relocations. `#84` measured the roster declining on any archive imperfection,
// so a general context-induced conservatism is a live possibility rather than a
// theoretical one.
//
// RELOCATION CANDIDATES ARE ADJACENCIES, so one slice can appear in several. The
// unit of trial is a SLICE, and buying one twice would spend quota twice and
// count one model's answer twice in the tally.

/**
 * Label a control slice carries, so it is never pooled with a flagged class.
 */
export const CONTROL_CLASS = 'control-unflagged';

/**
 * One slice the trial will buy, with the label its rows carry.
 *
 * @example
 * ```ts
 * const pick: TrialSlice = { entryId: 'Mittens', chunkIndex: 7, sliceClass: 'relocation', };
 * ```
 */
export type TrialSlice = {
  /**
   * Entry the slice belongs to.
   */
  readonly entryId: string;

  /**
   * Slice position within that entry's preparation.
   */
  readonly chunkIndex: number;

  /**
   * Class the screen flagged, or {@link CONTROL_CLASS}.
   */
  readonly sliceClass: string;
};

/**
 * Flagged slices of one entry, deduplicated, each under one class.
 *
 * A SLICE FLAGGED TWO WAYS TAKES THE FIRST LABEL IN THIS ORDER, and the order is
 * deliberate rather than incidental: relocation is the class `#107` is about and
 * the one the window is expected to move, so a slice that is both a relocation
 * endpoint and something else is read as a relocation. The alternative, dropping
 * multiply-flagged slices, would discard exactly the ambiguous cases the trial
 * exists to resolve.
 *
 * @param entryId - entry these slices belong to
 *
 * @param displacement - what the screen found for it
 *
 * @returns One entry per flagged slice, no slice twice
 *
 * @example
 * ```ts
 * const flagged = flaggedSlices({ entryId, displacement, },);
 * ```
 */
export function flaggedSlices(
  {
    entryId,
    displacement,
  }: {
    readonly entryId: string;
    readonly displacement: DocumentDisplacement;
  },
): readonly TrialSlice[] {
  /**
   * Class already assigned to each slice, which is what keeps a slice from
   * being bought twice.
   */
  const assigned = new Map<number, string>();

  /**
   * Both endpoints of every relocation candidate, which are adjacencies and so
   * overlap by construction.
   */
  const relocation = displacement.relocationCandidates
    .flatMap(function toEnds(candidate,): readonly number[] {
      return [
        candidate.high,
        candidate.low,
      ];
    },);

  for (const [sliceClass, indices,] of [
    [
      'relocation',
      relocation,
    ],
    [
      'untranslated',
      displacement.untranslated,
    ],
    [
      'target-only',
      displacement.targetOnly,
    ],
    [
      'other-imbalance',
      displacement.otherImbalances,
    ],
  ] as const) {
    for (const chunkIndex of indices) {
      if (assigned.has(chunkIndex,))
        continue;
      assigned.set(
        chunkIndex,
        sliceClass,
      );
    }
  }

  return [...assigned,]
    .map(function toSlice([chunkIndex, sliceClass,],): TrialSlice {
      return {
        entryId,
        chunkIndex,
        sliceClass,
      };
    },)
    .toSorted(function byIndex(
      left,
      right,
    ): number {
      return left.chunkIndex - right.chunkIndex;
    },);
}

/**
 * Unflagged slices of the same entry, drawn as controls.
 *
 * DRAWN FROM THE SAME ENTRIES as the flagged ones, deliberately. A control from
 * elsewhere in the corpus would differ in author, register and era as well as in
 * being unflagged, and any of those could move a judge. Same document, same
 * preparation, same everything except the thing under test.
 *
 * EVENLY SPACED rather than taken from the front, because slices early in a
 * document are systematically different: they carry the opening, and several
 * entries begin with a heading-plus-stub the screen would not flag but a judge
 * reads differently from body prose.
 *
 * @param entryId - entry to draw from
 *
 * @param displacement - what the screen found for it
 *
 * @param wanted - how many controls to draw
 *
 * @returns Up to `wanted` unflagged slices, evenly spaced
 *
 * @example
 * ```ts
 * const controls = controlSlices({ entryId, displacement, wanted: 2, },);
 * ```
 */
export function controlSlices(
  {
    entryId,
    displacement,
    wanted,
  }: {
    readonly entryId: string;
    readonly displacement: DocumentDisplacement;
    readonly wanted: number;
  },
): readonly TrialSlice[] {
  /**
   * Slices this entry had flagged, whatever the class.
   */
  const flagged = new Set(flaggedSlices({
    entryId,
    displacement,
  },)
    .map(function toIndex(slice,): number {
      return slice.chunkIndex;
    },),);

  /**
   * Every slice the screen left alone.
   */
  const unflagged = displacement.slices
    .map(function toIndex(
      _classified,
      chunkIndex,
    ): number {
      return chunkIndex;
    },)
    .filter(function notFlagged(chunkIndex,): boolean {
      return !flagged.has(chunkIndex,);
    },);
  if ((wanted <= 0) || (unflagged.length === 0))
    return [];

  /**
   * Stride that spreads the draw across the document rather than clustering it.
   */
  const stride = Math.max(
    1,
    Math.floor(unflagged.length / wanted,),
  );

  return unflagged
    .filter(function onStride(
      _chunkIndex,
      position,
    ): boolean {
      return (position % stride) === 0;
    },)
    .slice(
      0,
      wanted,
    )
    .map(function toSlice(chunkIndex,): TrialSlice {
      return {
        entryId,
        chunkIndex,
        sliceClass: CONTROL_CLASS,
      };
    },);
}

//endregion Window trial draw
