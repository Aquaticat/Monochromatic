/**
 * Pure statistics helpers for the compile-pipeline metrics overlay.
 *
 * Extracted from `metrics-overlay.ts` so the overlay file stays under
 * the per-file line cap. Functions here have no DOM dependencies and
 * are easy to unit-test in isolation.
 */

/**
 * 99th percentile divisor.
 */
export const PERCENTILE_99 = 0.99;

/**
 * Halfway split for the median when sample count is even.
 */
const MEDIAN_SPLIT = 0.5;

/**
 * Returns the value at `percentile` (0..1) of a sorted ascending
 * sample array. Uses nearest-rank: `samples[ceil(p * n) - 1]`.
 *
 * @param input - sorted samples + percentile
 *
 * @returns the value at that percentile, or 0 when the array is empty
 *
 * @example
 * ```ts
 * percentile({ sortedAsc: [1, 2, 3, 4], p: 0.5 }); // 2
 * ```
 */
export function percentile(
  input: {
    readonly sortedAsc: readonly number[];
    readonly p: number;
  },
): number {
  if (input.sortedAsc
    .length
    === 0)
    return 0;
  /**
   * Nearest-rank index clamped to 0 so empty-but-passing checks still index safely.
   */
  const rank = Math.max(
    0,
    Math.ceil(input.p
      * input
      .sortedAsc
      .length,)
      - 1,
  );
  return input.sortedAsc[rank]
    ?? 0;
}

/**
 * Computes the median of a sorted ascending sample array.
 *
 * @param sortedAsc - ascending samples
 *
 * @returns median, or 0 when empty
 *
 * @example
 * ```ts
 * median([1, 2, 3, 4]); // 2.5
 * ```
 */
export function median(sortedAsc: readonly number[],): number {
  if (sortedAsc.length
    === 0)
    return 0;
  /**
   * Center index for odd-length arrays; upper of the two centers for even-length arrays.
   */
  const mid = Math.floor(sortedAsc.length
    * MEDIAN_SPLIT,);
  if ((sortedAsc.length
    % 2) === 1)
    return sortedAsc[mid]
      ?? 0;
  return ((sortedAsc[mid - 1]
    ?? 0) + (sortedAsc[mid]
      ?? 0)) * MEDIAN_SPLIT;
}
