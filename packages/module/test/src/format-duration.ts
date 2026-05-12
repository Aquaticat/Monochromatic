/**
 * Adaptive duration formatter for test harness summary lines.
 * `performance.now()` returns sub-millisecond precision (microseconds
 * on Node, nanoseconds on Bun); truncating to whole milliseconds
 * collapses most unit-test durations to `0ms` or `1ms`, hiding the
 * per-test drift signal that the duration log exists to surface.
 *
 * The output scales by magnitude so summary columns stay narrow on
 * slow tests while fast tests retain sub-ms detail.
 *
 * @module
 */

/**
 * Cutoff below which a duration renders with one decimal place.
 * Above this, decimals add noise without adding signal (a 51.23ms
 * test is not more informative than 51ms when the unit is "ms").
 */
const DECIMAL_BELOW_MS = 10;

/**
 * Milliseconds per second. Used both as the seconds-cutoff and as
 * the divisor for the seconds branch.
 */
const MS_PER_SECOND = 1_000;

/**
 * Format an elapsed duration in milliseconds for human-readable logs.
 *
 * - below 10ms: one decimal, e.g. `0.3ms`, `9.9ms`
 * - 10ms to 999ms: whole ms, e.g. `51ms`, `999ms`
 * - 1000ms and above: one decimal in seconds, e.g. `1.2s`
 *
 * @param durationMs - elapsed time in milliseconds, typically from a
 *   `performance.now()` delta
 *
 * @returns formatted duration with unit suffix
 *
 * @example
 * formatDuration(0.34); // "0.3ms"
 * formatDuration(9.9); // "9.9ms"
 * formatDuration(51); // "51ms"
 * formatDuration(1234); // "1.2s"
 */
export function formatDuration(durationMs: number,): string {
  if (durationMs < DECIMAL_BELOW_MS)
    return `${durationMs.toFixed(1,)}ms`;
  if (durationMs < MS_PER_SECOND)
    return `${durationMs.toFixed(0,)}ms`;
  return `${(durationMs / MS_PER_SECOND).toFixed(1,)}s`;
}
