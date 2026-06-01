/**
 * Rate-limit warning projection and footer formatting.
 *
 * @module
 */

import { parseRateLimitSnapshots, } from './rate-limit-headers.ts';
import {
  CAUTION_REMAINING_THRESHOLD,
  CRITICAL_REMAINING_THRESHOLD,
  MILLISECONDS_PER_SECOND,
  MIN_PROJECTION_ELAPSED_SECONDS,
  MIN_USAGE_PERCENT_FOR_PROJECTION,
  PROJECTED_OVERFLOW_THRESHOLD,
  RATE_LIMIT_REMAINING_THRESHOLD,
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
 * This mirrors the Claude Code statusline `formatRateLimit` projection:
 * recover elapsed window time as `windowSeconds - secondsUntilReset`, then
 * extrapolate current used percentage over the full window. Anthropic token
 * response headers are per-minute limiters, so each parsed snapshot carries a
 * 60 second window.
 *
 * @param snapshot - current limiter sample
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
   * Seconds until provider reports the limiter as fully replenished.
   */
  const secondsUntilReset = (snapshot.resetAtMs - nowMs) / MILLISECONDS_PER_SECOND;
  /**
   * Elapsed seconds recovered from fixed limiter window and reset timestamp.
   */
  const elapsedSeconds = snapshot.windowSeconds - secondsUntilReset;

  if (elapsedSeconds < MIN_PROJECTION_ELAPSED_SECONDS)
    return 0;
  if (snapshot.usedPercent < MIN_USAGE_PERCENT_FOR_PROJECTION)
    return 0;

  return (snapshot.usedPercent / elapsedSeconds) * snapshot.windowSeconds;
}

//endregion Projection

//region Segment formatting

/**
 * Chooses warning style for remaining capacity and projection state.
 *
 * @param remainingPercent - floored remaining capacity percentage
 *
 * @param isProjectedOverflow - whether projected usage exceeds capacity
 *
 * @param style - theme style hooks
 *
 * @returns style function for warning text
 *
 * @example
 * ```ts
 * warningStyleFor({ remainingPercent: 12, isProjectedOverflow: false, style });
 * ```
 */
function warningStyleFor({
  remainingPercent,
  isProjectedOverflow,
  style,
}: Readonly<{
  remainingPercent: number;
  isProjectedOverflow: boolean;
  style: UsageWarningStyle;
}>,): (text: string,) => string {
  if (isProjectedOverflow || (remainingPercent <= CRITICAL_REMAINING_THRESHOLD))
    return style.critical;
  if (remainingPercent <= CAUTION_REMAINING_THRESHOLD)
    return style.caution;
  return style.healthy;
}

/**
 * Formats projected-overflow suffix.
 *
 * @param isProjectedOverflow - whether projection should be shown
 *
 * @param projectedPercent - projected used percentage
 *
 * @returns overflow suffix, or empty string when projection is hidden
 *
 * @example
 * ```ts
 * formatProjectionMarker({ isProjectedOverflow: true, projectedPercent: 120 });
 * ```
 */
function formatProjectionMarker({
  isProjectedOverflow,
  projectedPercent,
}: Readonly<{
  isProjectedOverflow: boolean;
  projectedPercent: number;
}>,): string {
  return isProjectedOverflow
    ? ` →${Math.floor(projectedPercent,)}%`
    : '';
}

/**
 * Formats one limiter segment.
 *
 * @param snapshot - current limiter sample
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @param style - theme style hooks
 *
 * @returns footer segment, or empty string when no warning should render
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
  /**
   * Whether projection exceeds available capacity.
   */
  const isProjectedOverflow = projectedPercent > PROJECTED_OVERFLOW_THRESHOLD;

  if ((snapshot.remainingPercent > RATE_LIMIT_REMAINING_THRESHOLD) && (!isProjectedOverflow))
    return '';

  /**
   * Style function selected for the warning severity.
   */
  const color = warningStyleFor({
    remainingPercent: snapshot.remainingPercent,
    isProjectedOverflow,
    style,
  },);
  /**
   * Optional projected-overflow annotation.
   */
  const projectionMarker = formatProjectionMarker({
    isProjectedOverflow,
    projectedPercent,
  },);
  /**
   * Human-readable duration until this limiter resets.
   */
  const timeLeft = formatRelativeTime({
    resetAtMs: snapshot.resetAtMs,
    nowMs,
  },);

  return `${snapshot.label} ${
    color(`${snapshot.remainingPercent}% left${projectionMarker}`,)
  } (${timeLeft})`;
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
 * isNonEmptySegment('tokens 40% left');
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
 * @returns status text for visible warnings
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
   * Formatted warning segments that should appear in the footer.
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
