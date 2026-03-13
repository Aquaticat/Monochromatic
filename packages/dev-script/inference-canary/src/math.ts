/**
 * Small numeric utilities used across runner and history subsystems.
 */

/**
 * Computes the arithmetic mean of a numeric array.
 * Returns 0 for empty arrays to avoid NaN propagation.
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
export function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce(function accumulate(sum, value): number { return sum + value; }, 0) / values.length;
}
