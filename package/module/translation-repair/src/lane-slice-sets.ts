import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import { LaneSliceCoverageError, } from './lane-slice-coverage-error.ts';

//region Lane slice sets
// The slices a lane NAMES as something other than decided, and the five checks
// each of those lists has to pass.
//
// Three such lists exist, and they arrived one at a time: unfilled, then
// unheard, then not-applicable. Each was written as its own loop against the
// preparation, and by the third the loops were the same five checks with the
// wording changed, which is how the pairwise disjointness between them came to
// be checked in one direction only.
//
// So the checks live here once and the lists differ by DATA: what each is
// called, what it says when a slice is named twice, and which side of the
// archive it belongs to. That last one is the check worth having: every list
// here is only legal at one kind of slice, and getting it wrong is how an
// exemption list becomes a way around the coverage rule.

/**
 * One list of slices a lane names, beside what makes the list legal.
 *
 * @example
 * ```ts
 * const set: NamedSliceSet = {
 *   label: 'unfilled',
 *   indices: [3,],
 *   decidedClause: 'so what it accepted there is unstated',
 *   incumbent: 'absent',
 *   incumbentClause: 'and the archive holds wording for it: only a slice with none can be unfilled',
 * };
 * ```
 */
export type NamedSliceSet = {
  /**
   * What the lane calls these slices, which every message repeats.
   */
  readonly label: string;

  /**
   * Slices named, by global index.
   */
  readonly indices: readonly number[];

  /**
   * What is lost when a slice is named here AND decided, as a clause.
   */
  readonly decidedClause: string;

  /**
   * Which side of the archive this list is legal at: `absent` for lists about
   * passages the archive never translated, `present` for lists about wording it
   * holds.
   */
  readonly incumbent: 'absent' | 'present';

  /**
   * Why the other side is wrong, as a clause.
   */
  readonly incumbentClause: string;
};

/**
 * Refuses a list that repeats a slice, and turns it into a set.
 *
 * @param set - list being checked, for its label and indices
 *
 * @returns Distinct indices it names
 *
 * @throws {@link LaneSliceCoverageError} when an index appears twice, since the
 * set would still be the right shape and one slice would be named once
 *
 * @example
 * ```ts
 * const unfilled = distinctIndices({ set, },);
 * ```
 */
function distinctIndices(
  { set, }: { readonly set: NamedSliceSet; },
): ReadonlySet<number> {
  /**
   * Indices this list names, with any repeat collapsed.
   */
  const distinct = new Set(set.indices,);

  /**
   * How many the list claims, before the repeats were collapsed.
   */
  const claimed = set.indices
    .length;
  if (distinct.size !== claimed) {
    throw new LaneSliceCoverageError({
      message: `lane reports ${String(claimed,)} ${set.label} slices under ${
        String(distinct.size,)
      } distinct indices`,
    },);
  }
  return distinct;
}

/**
 * Refuses a named slice the preparation never produced, one already decided, or
 * one whose archive state contradicts what the list means.
 *
 * @param set - list being checked
 *
 * @param indices - its indices, already proven distinct
 *
 * @param slices - prepared pairs, which answer both membership and archive
 * state
 *
 * @param decidedIndices - slices the lane also reported a wording for
 *
 * @throws {@link LaneSliceCoverageError} on any of the three
 *
 * @example
 * ```ts
 * assertNamesLegalSlices({ set, indices, slices, decidedIndices, },);
 * ```
 */
function assertNamesLegalSlices(
  {
    set,
    indices,
    slices,
    decidedIndices,
  }: {
    readonly set: NamedSliceSet;
    readonly indices: ReadonlySet<number>;
    readonly slices: readonly ChunkPair[];
    readonly decidedIndices: ReadonlySet<number>;
  },
): void {
  for (const chunkIndex of indices) {
    /**
     * Pair this index names, absent when the two were built from different
     * preparations.
     */
    const named = slices.find(function isNamed(slice,): boolean {
      return slice.target
        .chunkIndex
        === chunkIndex;
    },);
    if (named === undefined) {
      throw new LaneSliceCoverageError({
        message: `lane reports slice ${String(chunkIndex,)} ${set.label}, `
          + 'which this preparation never produced',
      },);
    }
    if (decidedIndices.has(chunkIndex,)) {
      throw new LaneSliceCoverageError({
        message: `lane reports slice ${String(chunkIndex,)} as ${set.label} and decided at once, ${set.decidedClause}`,
      },);
    }
  }
}

/**
 * Refuses a named slice sitting on the wrong side of the archive.
 *
 * Checked LAST of the per-list rules, so a slice named by two lists reports the
 * contradiction between them rather than whichever archive rule the first list
 * happens to break.
 *
 * @param set - list being checked
 *
 * @param indices - its indices
 *
 * @param slices - prepared pairs, which are the only thing that knows
 *
 * @throws {@link LaneSliceCoverageError} when a list about missing passages
 * names one the archive translates, or the other way around
 *
 * @example
 * ```ts
 * assertArchiveAllows({ set, indices, slices, },);
 * ```
 */
function assertArchiveAllows(
  {
    set,
    indices,
    slices,
  }: {
    readonly set: NamedSliceSet;
    readonly indices: ReadonlySet<number>;
    readonly slices: readonly ChunkPair[];
  },
): void {
  for (const chunkIndex of indices) {
    /**
     * Pair this index names, which {@link assertNamesLegalSlices} proved is
     * there.
     */
    const named = slices.find(function isNamed(slice,): boolean {
      return slice.target
        .chunkIndex
        === chunkIndex;
    },);

    /**
     * Whether the archive holds nothing at this slice.
     */
    const absent = (named !== undefined) && isInsertionChunk(named.target,);
    if ((named !== undefined) && (absent !== (set.incumbent === 'absent'))) {
      throw new LaneSliceCoverageError({
        message: `lane reports slice ${String(chunkIndex,)} ${set.label}, ${set.incumbentClause}`,
      },);
    }
  }
}

/**
 * Validates every list a lane names, and refuses any slice on two of them.
 *
 * @param sets - lists to validate, in the order their messages should be tried
 *
 * @param slices - prepared pairs
 *
 * @param decidedIndices - slices the lane reported a wording for
 *
 * @returns One index set per list, in the order given
 *
 * @throws {@link LaneSliceCoverageError} when a list repeats a slice, names one
 * the preparation never produced, names one already decided, names one another
 * list also names, or names one whose archive state the list forbids
 *
 * @example
 * ```ts
 * const [unfilled, unheard,] = validateNamedSets({ sets, slices, decidedIndices, },);
 * ```
 */
export function validateNamedSets(
  {
    sets,
    slices,
    decidedIndices,
  }: {
    readonly sets: readonly NamedSliceSet[];
    readonly slices: readonly ChunkPair[];
    readonly decidedIndices: ReadonlySet<number>;
  },
): readonly ReadonlySet<number>[] {
  /**
   * Each list as a set, refusing repeats within one list.
   */
  const named = sets.map(function toSet(set,): ReadonlySet<number> {
    return distinctIndices({ set, },);
  },);
  for (const [position, set,] of sets.entries()) {
    /**
     * This list's indices, which the map above produced at the same position.
     */
    const indices = named[position] ?? new Set<number>();
    assertNamesLegalSlices({
      set,
      indices,
      slices,
      decidedIndices,
    },);
  }

  // BEFORE THE ARCHIVE RULES, because a slice named by two lists disagrees with
  // itself first: reporting which archive rule it breaks would answer a
  // question neither list has earned the right to ask.
  for (const [position, set,] of sets.entries()) {
    for (const [otherPosition, other,] of sets.entries()) {
      if (otherPosition <= position)
        continue;

      /**
       * Slices both lists name, which is a contradiction whichever two they
       * are.
       */
      const mine = named[position] ?? new Set<number>();

      /**
       * Indices the later list names.
       */
      const theirs = named[otherPosition] ?? new Set<number>();

      /**
       * Slices both name, which is a contradiction whichever two lists they are.
       */
      const both = [...mine,].filter(function inOther(chunkIndex,): boolean {
        return theirs.has(chunkIndex,);
      },);
      for (const chunkIndex of both) {
        throw new LaneSliceCoverageError({
          message: `lane reports slice ${String(chunkIndex,)} as ${set.label} and ${other.label} `
            + 'at once, so what it did there is stated twice and differently',
        },);
      }
    }
  }
  for (const [position, set,] of sets.entries()) {
    assertArchiveAllows({
      set,
      indices: named[position] ?? new Set<number>(),
      slices,
    },);
  }
  return named;
}

//endregion Lane slice sets
