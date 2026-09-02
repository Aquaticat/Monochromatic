import type { UnfilledSlice, } from '../translate-document-contract.ts';

//region Publication completeness
// A corpus artifact may retain evidence about a missing passage, and a published
// memorial page omits such a passage only with the gap recorded, never silently.
//
// THE PAGE SHIPS WITHOUT THE PASSAGE, since the no-loop design of 2026-09-01
// (doc/planning/translation-repair-no-loop-design.md, "Insertion placement,
// single round"): an insertion is recovered supplementary content whose
// absence is a recorded gap, not a missing required page. The refusal below
// predates that design and outlived it: on 2026-09-02 it dropped XIEPT2 after
// 35 minutes over one passage the judges could not back in two rounds, and
// the publish test records an earlier XIEPT2 attempt lost the same way after
// four hours forty-eight minutes. The pass now records the gap as findings and
// publishes; the refusal is kept for callers that still want to fail closed.

/**
 * Raised before publication when translation left a source passage unfilled.
 *
 * @example
 * ```ts
 * const error = new UnfilledPageError({
 *   entryId: 'CatEntry',
 *   unfilled: [{ sliceIndex: 2, reason: 'not-corroborated', findings: [], }],
 * },);
 * ```
 */
export class UnfilledPageError extends Error {
  /**
   * Declares this message safe to forward: it names entry id, counts and slice indexes.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Stable error class name after serialization.
   */
  public override readonly name = 'UnfilledPageError';

  /**
   * Corpus entry whose page remains incomplete.
   */
  readonly entryId: string;

  /**
   * Slice indexes whose source content has no shipped rendering.
   */
  readonly sliceIndices: readonly number[];

  /**
   * Builds one publication refusal.
   *
   * @param entryId - corpus entry being protected
   *
   * @param unfilled - source passages with no shipped rendering
   */
  constructor(
    {
      entryId,
      unfilled,
    }: {
      readonly entryId: string;
      readonly unfilled: readonly UnfilledSlice[];
    },
  ) {
    /**
     * Slice indexes carried in message and fields.
     */
    const sliceIndices = unfilled.map(function toSliceIndex(passage,): number {
      return passage.sliceIndex;
    },);
    super(
      `entry ${entryId} retains ${String(sliceIndices.length,)} unfilled source passage(s) at slices ${sliceIndices.join(', ',)}`,
    );
    this.entryId = entryId;
    this.sliceIndices = sliceIndices;
  }
}

/**
 * Refuses publication when a translation records any source passage unfilled.
 *
 * @param entryId - corpus entry being protected
 *
 * @param unfilled - source passages with no shipped rendering
 *
 * @throws {@link UnfilledPageError} when any passage remains unfilled
 *
 * @example
 * ```ts
 * assertPublishableTranslation({ entryId: 'CatEntry', unfilled: [], });
 * ```
 */
export function assertPublishableTranslation(
  {
    entryId,
    unfilled,
  }: {
    readonly entryId: string;
    readonly unfilled: readonly UnfilledSlice[];
  },
): void {
  if (unfilled.length === 0)
    return;
  throw new UnfilledPageError({
    entryId,
    unfilled,
  },);
}

/**
 * Findings that record each unfilled source passage a page ships without.
 *
 * @param unfilled - source passages with no shipped rendering
 *
 * @returns One finding per passage, naming the slice and why it is unfilled
 *
 * @example
 * ```ts
 * unfilledPageFindings({ unfilled: [{ sliceIndex: 15, reason: 'no-candidate-backed', findings: [], }], },);
 * // => ['source-passage-unfilled (slice 15, no-candidate-backed): the page ships without this passage, recorded as a gap']
 * ```
 */
export function unfilledPageFindings(
  { unfilled, }: { readonly unfilled: readonly UnfilledSlice[]; },
): readonly string[] {
  return unfilled.map(function toFinding(passage,): string {
    return `source-passage-unfilled (slice ${String(passage.sliceIndex,)}, ${passage.reason}): `
      + 'the page ships without this passage, recorded as a gap';
  },);
}

//endregion Publication completeness
