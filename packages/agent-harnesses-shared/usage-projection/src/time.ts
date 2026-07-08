/**
 * Relative reset-time formatting.
 *
 * @module
 */

import {
  MILLISECONDS_PER_SECOND,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
} from './constants.ts';

//region Relative time

/**
 * Formats milliseconds until reset as a compact relative duration.
 *
 * @param resetAtMs - reset timestamp in epoch milliseconds
 *
 * @param renderedAtMs - render timestamp in epoch milliseconds
 *
 * @returns compact duration like `3h2m`, or `now` once reset has passed
 *
 * @example
 * ```ts
 * formatRelativeTime({ resetAtMs: Date.now() + 60_000, renderedAtMs: Date.now() });
 * ```
 */
function formatRelativeTime({
  resetAtMs,
  renderedAtMs,
}: Readonly<{
  resetAtMs: number;
  renderedAtMs: number;
}>,): string {
  /**
   * Remaining whole seconds until reset.
   */
  const diffSeconds = Math.ceil((resetAtMs - renderedAtMs) / MILLISECONDS_PER_SECOND,);

  if (diffSeconds <= 0)
    return 'now';
  if (diffSeconds < SECONDS_PER_MINUTE)
    return `${diffSeconds}s`;
  if (diffSeconds < SECONDS_PER_HOUR)
    return `${Math.floor(diffSeconds / SECONDS_PER_MINUTE,)}m`;
  if (diffSeconds < SECONDS_PER_DAY) {
    /**
     * Whole hours in remaining reset duration.
     */
    const hours = Math.floor(diffSeconds / SECONDS_PER_HOUR,);
    /**
     * Remaining whole minutes after whole hours are removed.
     */
    const minutes = Math.floor((diffSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE,);
    return minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`;
  }

  /**
   * Whole days in remaining reset duration.
   */
  const days = Math.floor(diffSeconds / SECONDS_PER_DAY,);
  /**
   * Remaining whole hours after whole days are removed.
   */
  const hours = Math.floor((diffSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR,);
  return hours > 0 ? `${days}d${hours}h` : `${days}d`;
}

//endregion Relative time

export { formatRelativeTime, };
