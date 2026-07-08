/**
 * Burn-rate usage projection helpers.
 *
 * @module
 */

import {
  MILLISECONDS_PER_SECOND,
  MIN_PROJECTION_ELAPSED_SECONDS,
  MIN_USAGE_PERCENT_FOR_PROJECTION,
} from './constants.ts';
import type { RateLimitSnapshot, } from './types.ts';

//region Projection

/**
 * Projects usage at fixed window end from current used percentage and reset time.
 *
 * Projection recovers elapsed window time as
 * `windowSeconds - secondsUntilResetAtSample`,
 * then extrapolates current used percentage over the full window.
 * Providers that expose fractional quota regeneration set `paceScale` to
 * normalize elapsed pace before projection.
 *
 * @param snapshot - current {@link RateLimitSnapshot}
 *
 * @returns projected used percentage at window end, or zero when projection is not stable
 *
 * @example
 * ```ts
 * projectUsagePercent({ snapshot });
 * ```
 */
function projectUsagePercent({
  snapshot,
}: Readonly<{
  snapshot: RateLimitSnapshot;
}>,): number {
  /**
   * Seconds until provider reports the usage window as reset or replenished.
   */
  const secondsUntilReset = (snapshot.resetAtMs - snapshot.sampledAtMs) / MILLISECONDS_PER_SECOND;
  /**
   * Elapsed seconds recovered from fixed limiter window and sample timestamp.
   */
  const elapsedSeconds = snapshot.windowSeconds - secondsUntilReset;
  /**
   * Elapsed seconds after provider-specific pace normalization.
   */
  const effectiveElapsedSeconds = elapsedSeconds * snapshot.paceScale;

  if (elapsedSeconds < MIN_PROJECTION_ELAPSED_SECONDS)
    return 0;
  if (effectiveElapsedSeconds <= 0)
    return 0;
  if (snapshot.usedPercent < MIN_USAGE_PERCENT_FOR_PROJECTION)
    return 0;

  return (snapshot.usedPercent / effectiveElapsedSeconds) * snapshot.windowSeconds;
}

/**
 * Formats projected-overrun marker.
 *
 * @param projectedPercent - projected used percentage
 *
 * @returns overrun marker like `→120%`
 *
 * @example
 * ```ts
 * formatProjectionMarker(120);
 * ```
 */
function formatProjectionMarker(projectedPercent: number,): string {
  return `→${Math.floor(projectedPercent,)}%`;
}

//endregion Projection

export {
  formatProjectionMarker,
  projectUsagePercent,
};
