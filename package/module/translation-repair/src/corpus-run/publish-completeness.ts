import type { UnfilledSlice, } from '../translate-document-contract.ts';

//region Publication completeness
// A corpus artifact may retain evidence about a missing passage, but a published
// memorial page may not silently omit source content the pipeline itself names.

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
    const sliceIndices = unfilled.map(function toSliceIndex(passage,): number {
      return passage.sliceIndex;
    },);
    super(
      `entry ${entryId} retains ${String(sliceIndices.length,)} unfilled source passage(s) at slices ${sliceIndices.join(', ',)}`,
    );
    this.name = UnfilledPageError.name;
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

//endregion Publication completeness
