/**
 * Small numeric utilities used across runner and history subsystems.
 */

/**
 * Computes the arithmetic mean of a numeric array.
 * Returns 0 for empty arrays to avoid NaN propagation.
 *
 * @remarks
 * Uses a running-sum reduction, so the result accumulates IEEE 754 rounding error:
 * for inputs whose ratio is not exactly representable in binary
 * (e.g., `13 / 20 = 0.65`),
 * the returned value may differ from the mathematically-exact mean by a small number of ULPs.
 * The same input set, fed through this function in a different order,
 * can serialize via `JSON.stringify` as either `0.65` or `0.6499999999999999`.
 * Callers comparing scores should use tolerance, not equality;
 * see the "Numeric precision" section in this package's README.
 *
 * @param values - numbers to average
 *
 * @returns arithmetic mean, or 0 when the array is empty
 *
 * @example
 * ```ts
 * mean([1, 2, 3]); // 2
 * mean([]); // 0
 * ```
 */
export function mean(values: readonly number[],): number {
  if (values.length
    === 0)
    return 0;
  return values.reduce(
    function accumulate(
      sum,
      value,
    ): number {
      return sum + value;
    },
    0,
  )
    / values
    .length;
}
