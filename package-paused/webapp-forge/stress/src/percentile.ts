/**
 * Latency-distribution helpers.
 *
 * Tiny implementations sufficient for stress reports; not used by hot
 * loops.
 */

/**
 * Returns the percentile value of a sample array.
 *
 * @param row - sample and percentile fraction (0..1)
 *
 * @returns percentile value (0 when the sample is empty)
 *
 * @example
 * ```ts
 * percentile({ samples: [1,2,3,4,5,6,7,8,9,10], p: 0.5 }); // 5 or 6 depending on rounding
 * ```
 */
export function percentile(row: {
  samples: readonly number[];
  p: number;
},): number {
  if (row.samples
    .length
    === 0)
    return 0;
  /**
   * Ascending copy preserves the caller's readonly input while enabling positional lookup.
   */
  const sorted = [...row.samples,].toSorted(function compareAsc(
    a,
    b,
  ) {
    return a - b;
  },);
  /**
   * Clamped position so out-of-range fractions still resolve to a real sample.
   */
  const index = Math.min(
    sorted.length
      - 1,
    Math.max(
      0,
      Math.floor(row.p
        * sorted
        .length,),
    ),
  );
  return sorted[index]
    ?? 0;
}
