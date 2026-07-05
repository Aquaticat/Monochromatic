/**
 * Projected-overflow warning projection and footer formatting.
 *
 * @module
 */

import { parseRateLimitSnapshots, } from './rate-limit-headers.ts';
import {
  MILLISECONDS_PER_SECOND,
  MIN_PROJECTION_ELAPSED_SECONDS,
  MIN_USAGE_PERCENT_FOR_PROJECTION,
  PROJECTED_OVERFLOW_THRESHOLD,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  type RateLimitSnapshot,
  type UsageWarningStatus,
  type UsageWarningStyle,
} from './rate-limit-types.ts';

//region Relative time

/**
 * Formats milliseconds until reset as a compact relative duration.
 *
 * @param resetAtMs - reset timestamp in epoch milliseconds
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @returns compact duration like `3h2m`, or `now` once reset has passed
 *
 * @example
 * ```ts
 * formatRelativeTime({ resetAtMs: Date.now() + 60_000, nowMs: Date.now() });
 * ```
 */
function formatRelativeTime({
  resetAtMs,
  nowMs,
}: Readonly<{
  resetAtMs: number;
  nowMs: number;
}>,): string {
  /**
   * Remaining whole seconds until reset.
   */
  const diffSeconds = Math.ceil((resetAtMs - nowMs) / MILLISECONDS_PER_SECOND,);

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

//region Projection

/**
 * Projects usage at fixed window end from current used percentage and reset time.
 *
 * This mirrors the Claude Code statusline projection: recover elapsed window
 * time as `windowSeconds - secondsUntilReset`, then extrapolate current used
 * percentage over the full window. Providers that expose fractional quota
 * regeneration, such as Synthetic weekly credits, set `paceScale` to normalize
 * elapsed pace before projection.
 *
 * @param snapshot - current {@link RateLimitSnapshot}
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @returns projected used percentage at window end, or zero when projection is not stable
 *
 * @example
 * ```ts
 * projectUsagePercent({ snapshot, nowMs: Date.now() });
 * ```
 */
function projectUsagePercent({
  snapshot,
  nowMs,
}: Readonly<{
  snapshot: RateLimitSnapshot;
  nowMs: number;
}>,): number {
  /**
   * Seconds until provider reports the usage window as reset or replenished.
   */
  const secondsUntilReset = (snapshot.resetAtMs - nowMs) / MILLISECONDS_PER_SECOND;
  /**
   * Elapsed seconds recovered from fixed limiter window and reset timestamp.
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

//endregion Projection

//region Segment formatting

/**
 * Formats projected-overflow marker.
 *
 * @param projectedPercent - projected used percentage
 *
 * @returns overflow marker like `→120%`
 *
 * @example
 * ```ts
 * formatProjectionMarker(120);
 * ```
 */
function formatProjectionMarker(projectedPercent: number,): string {
  return `→${Math.floor(projectedPercent,)}%`;
}

/**
 * Formats one projected-overflow segment.
 *
 * @param snapshot - current limiter sample
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @param style - theme style hooks
 *
 * @returns footer segment, or empty string when projection does not overflow
 *
 * @example
 * ```ts
 * formatUsageWarningSegment({ snapshot, nowMs: Date.now(), style });
 * ```
 */
function formatUsageWarningSegment({
  snapshot,
  nowMs,
  style,
}: Readonly<{
  snapshot: RateLimitSnapshot;
  nowMs: number;
  style: UsageWarningStyle;
}>,): string {
  /**
   * Projected used percentage at fixed window end.
   */
  const projectedPercent = projectUsagePercent({
    snapshot,
    nowMs,
  },);

  if (projectedPercent <= PROJECTED_OVERFLOW_THRESHOLD)
    return '';

  /**
   * Projected-overflow annotation.
   */
  const projectionMarker = formatProjectionMarker(projectedPercent,);
  /**
   * Human-readable duration until this usage window resets or replenishes.
   */
  const timeLeft = formatRelativeTime({
    resetAtMs: snapshot.resetAtMs,
    nowMs,
  },);

  return `${snapshot.label} ${style.overflow(projectionMarker,)} (${timeLeft})`;
}

/**
 * Detects non-empty formatted status segments.
 *
 * @param segment - formatted segment candidate
 *
 * @returns whether segment should be displayed
 *
 * @example
 * ```ts
 * isNonEmptySegment('tokens →120%');
 * ```
 */
function isNonEmptySegment(segment: string,): boolean {
  return segment.length > 0;
}

//endregion Segment formatting

//region Public formatter

/**
 * Formats Pi footer status text from provider response headers.
 *
 * @param headers - provider response headers from Pi
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @param style - theme style hooks
 *
 * @returns {@link UsageWarningStatus} for projected-overflow warnings
 *
 * @example
 * ```ts
 * const result = formatUsageWarningStatus({ headers, nowMs: Date.now(), style });
 * ```
 */
function formatUsageWarningStatus({
  headers,
  nowMs,
  style,
}: Readonly<{
  headers: Readonly<Record<string, string>>;
  nowMs: number;
  style: UsageWarningStyle;
}>,): UsageWarningStatus {
  /**
   * Valid limiter snapshots parsed from response headers.
   */
  const snapshots = parseRateLimitSnapshots({
    headers,
    nowMs,
  },);
  /**
   * Formatted projected-overflow segments that should appear in the footer.
   */
  const segments = snapshots
    .map(function formatSnapshot(snapshot,): string {
      return formatUsageWarningSegment({
        snapshot,
        nowMs,
        style,
      },);
    },)
    .filter(function keepSegment(segment,): boolean {
      return isNonEmptySegment(segment,);
    },);

  return {
    statusText: segments.join(' · ',),
  };
}

//endregion Public formatter

export {
  formatRelativeTime,
  formatUsageWarningSegment,
  formatUsageWarningStatus,
  projectUsagePercent,
};
