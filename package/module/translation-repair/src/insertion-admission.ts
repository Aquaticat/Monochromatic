import type { ChunkPair, } from './chunk-document.ts';
import { isInsertionChunk, } from './chunk-placement.ts';
import { admitWithinShortfall, } from './coverage-corroboration.ts';

//region Insertion admission
// The second signature at BLOCK scale, applied once over the whole page.
//
// `doc/decision/translation-repair-absence-verdict.md` requires two independent
// readings before anything is written into a page: a roster that read both texts
// must leave the passage unplaced, AND the page must be measurably too short to
// hold it. Section scale applies this in `chunk-insertion.ts`, where the whole
// page is in hand at once. Subdivision runs per SECTION, so the block-scale half
// has to be applied here instead, after every section has been carved.
//
// ONE BUDGET FOR THE WHOLE PAGE, not one per section. A page is short by a
// definite amount, and letting each section spend that amount separately would
// admit several times what the page is actually missing. Spending it in document
// order also makes the answer reproducible: two runs over the same page admit
// the same slices.
//
// A REFUSAL HERE IS NOT A FAILURE. The slice keeps the gap the archive already
// had, which `#100` landing 3 already supports: the driver records an unfilled
// passage per slice rather than losing the entry. What this prevents is writing
// English into a page that has no room to be missing it, which usually means the
// pairing found a merge rather than an omission.

/**
 * Chooses which insertion slices the page has room to be missing.
 *
 * @param slices - every prepared slice, in document order
 *
 * @param sourceText - whole original page
 *
 * @param targetText - whole translation as it stands
 *
 * @returns Positions in `slices` whose insertion the shortfall admits, so a
 * caller can test membership without matching on chunk indices, which name
 * different things depending on who stamped them
 *
 * @example
 * ```ts
 * const admitted = admitInsertions({ slices, sourceText, targetText, },);
 * ```
 */
export function admitInsertions(
  {
    slices,
    sourceText,
    targetText,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly targetText: string;
  },
): ReadonlySet<number> {
  /**
   * Positions holding a slice with no translation beside it, paired with the
   * original that would be written there.
   */
  const proposed = slices.flatMap(function toProposal(
    slice,
    at,
  ) {
    return isInsertionChunk(slice.target,)
      ? [{
        where: String(at,),
        sourceText: slice.source
          .text,
      },]
      : [];
  },);

  /**
   * Those the page has room for, named by the position strings handed in.
   */
  const admitted = admitWithinShortfall({
    sourceText,
    targetText,
    passages: proposed,
  },);

  return new Set(admitted.map(Number,),);
}

//endregion Insertion admission
