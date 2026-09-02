import { NaturalnessCompletenessError, } from '../naturalness-completeness-error.ts';
import type { SettledArtifact, } from './artifact-two-lane-contract.ts';
import { parseNaturalnessReview, } from './artifact-two-lane-read-naturalness-review.ts';

//region Final naturalness completeness

/**
 * Refuses schema-eight artifact without absolute approval of every consolidated body slice.
 *
 * Parser recomputes final review verdict and exact-text digest rather than
 * trusting writer aggregate. Syntax-bearing front matter remains explicitly
 * exempt, an unendorsed standing that shipped with its finding under the
 * no-loop design is accepted as recorded, and every other absent review fails
 * closed.
 *
 * @param artifact - in-memory artifact before page or artifact persistence
 *
 * @throws {@link NaturalnessCompletenessError} when body polish lacks approval
 *
 * @example
 * ```ts
 * assertFinalNaturalnessComplete({ artifact, });
 * ```
 */
export function assertFinalNaturalnessComplete(
  { artifact, }: { readonly artifact: SettledArtifact; },
): void {
  /**
   * Deciding stages artifact records.
   */
  const {
    consolidation,
    laneSelection,
  } = artifact;
  if (consolidation.kind !== 'settled') {
    if (laneSelection.kind !== 'contested')
      return;
    /**
     * First contested body slice proving final naturalness never ran.
     */
    const missing = laneSelection
      .slices
      .find(function body(slice,): boolean {
        /**
         * Syntax eligibility recorded only for front matter.
         */
        const { eligibility, } = slice;
        return eligibility?.syntax !== 'front-matter';
      },);
    if (missing !== undefined)
      throw new NaturalnessCompletenessError({ sliceIndex: missing.sliceIndex, },);
    return;
  }
  /**
   * Contest syntax by slice, absent for ordinary body text.
   */
  const syntaxBySlice = new Map((laneSelection.kind === 'contested')
    ? laneSelection
      .slices
      .map(function syntax(slice,) {
        return [
          slice.sliceIndex,
          slice.eligibility
            ?.syntax,
        ] as const;
      },)
    : [],);
  for (const slice of consolidation.slices) {
    /**
     * Recorded final polish for this consolidated slice.
     */
    const { polish, } = slice;
    if (syntaxBySlice.get(slice.sliceIndex,) === 'front-matter') {
      if ((polish?.kind === 'not-run') && (polish.reason === 'front-matter'))
        continue;
      throw new NaturalnessCompletenessError({ sliceIndex: slice.sliceIndex, },);
    }
    if (polish === undefined)
      throw new NaturalnessCompletenessError({ sliceIndex: slice.sliceIndex, },);
    // AN UNENDORSED STANDING SHIPS WITH ITS FINDING, per the no-loop design of
    // 2026-09-01 (doc/planning/translation-repair-no-loop-design.md, "Consolidation
    // recovery, single attempt"): when the standing text lacks contest endorsement
    // and the single consolidation attempt kept it, the text ships with
    // `consolidation-standing-unendorsed` recorded as evidence, and polish is not
    // run over a baseline the fidelity gates never admitted (`unsafe-baseline`).
    // This guard, written 2026-08-28 to require an approved polish on every body
    // slice, refused exactly that record: the Toka_ls rerun of 2026-09-02 ended
    // INCOMPLETE after 117 minutes on slice 10 with no page and no artifact. The
    // artifact carries the reason; the reading catches it.
    if ((polish.kind === 'not-run') && (polish.reason === 'unsafe-baseline'))
      continue;
    if (polish.kind !== 'settled')
      throw new NaturalnessCompletenessError({ sliceIndex: slice.sliceIndex, },);
    if (polish.review === undefined)
      throw new NaturalnessCompletenessError({ sliceIndex: slice.sliceIndex, },);
    parseNaturalnessReview({
      value: polish.review,
      path: `consolidation.slices[${String(slice.sliceIndex,)}].polish.review`,
      finalText: polish.text,
      correctionChainRequired: true,
    },);
  }
}

//endregion Final naturalness completeness
