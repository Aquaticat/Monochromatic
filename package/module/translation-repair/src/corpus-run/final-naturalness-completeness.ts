import { NaturalnessCompletenessError, } from '../naturalness-completeness-error.ts';
import type { SettledArtifact, } from './artifact-two-lane-contract.ts';
import { parseNaturalnessReview, } from './artifact-two-lane-read-naturalness-review.ts';

//region Final naturalness completeness

/**
 * Refuses schema-eight artifact without absolute approval of every consolidated body slice.
 *
 * Parser recomputes final review verdict and exact-text digest rather than
 * trusting writer aggregate. Syntax-bearing front matter remains explicitly
 * exempt and every other absent review fails closed.
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
    if (polish.kind !== 'settled')
      throw new NaturalnessCompletenessError({ sliceIndex: slice.sliceIndex, },);
    if (polish.review === undefined)
      throw new NaturalnessCompletenessError({ sliceIndex: slice.sliceIndex, },);
    parseNaturalnessReview({
      value: polish.review,
      path: `consolidation.slices[${String(slice.sliceIndex,)}].polish.review`,
      finalText: polish.text,
    },);
  }
}

//endregion Final naturalness completeness
