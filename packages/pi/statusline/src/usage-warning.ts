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
 * Projects usage at reset time from two sampled provider responses.
 *
 * Claude Code receives fixed-window `used_percentage` directly. Pi receives
 * Anthropic response headers instead, so this function estimates burn rate from
 * the previous and current samples for the same limiter.
 *
 * @param snapshot - current limiter sample
 *
 * @param previousSnapshot - previous limiter sample with same key
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @returns projected used percentage at reset, or zero when projection is not stable
 *
 * @example
 * ```ts
 * projectUsagePercent({ snapshot, previousSnapshot, nowMs: Date.now() });
 * ```
 */
function projectUsagePercent({
  snapshot,
  previousSnapshot,
  nowMs,
}: Readonly<{
  snapshot: RateLimitSnapshot;
  previousSnapshot?: RateLimitSnapshot;
  nowMs: number;
}>,): number {
  if (previousSnapshot === undefined)
    return 0;

  /**
   * Elapsed seconds between the previous and current samples.
   */
  const elapsedSeconds = (nowMs - previousSnapshot.sampledAtMs) / MILLISECONDS_PER_SECOND;
  /**
   * Increase in used percentage between samples.
   */
  const usedDelta = snapshot.usedPercent - previousSnapshot.usedPercent;
  /**
   * Seconds remaining before the provider reports full reset.
   */
  const secondsUntilReset = (snapshot.resetAtMs - nowMs) / MILLISECONDS_PER_SECOND;

  if (elapsedSeconds < MIN_PROJECTION_ELAPSED_SECONDS)
    return 0;
  if (usedDelta <= 0)
    return 0;
  if (secondsUntilReset <= 0)
    return 0;
  if (snapshot.usedPercent < MIN_USAGE_PERCENT_FOR_PROJECTION)
    return 0;

  return snapshot.usedPercent
    + ((usedDelta / elapsedSeconds) * secondsUntilReset);
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
 * @param previousSnapshot - previous limiter sample with same key
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @param style - theme style hooks
 *
 * @returns footer segment, or empty string when no warning should render
 *
 * @example
 * ```ts
 * formatUsageWarningSegment({ snapshot, previousSnapshot, nowMs: Date.now(), style });
 * ```
 */
function formatUsageWarningSegment({
  snapshot,
  previousSnapshot,
  nowMs,
  style,
}: Readonly<{
  snapshot: RateLimitSnapshot;
  previousSnapshot?: RateLimitSnapshot;
  nowMs: number;
  style: UsageWarningStyle;
}>,): string {
  /**
   * Projected used percentage at reset time.
   */
  const projectedPercent = previousSnapshot === undefined
    ? projectUsagePercent({
      snapshot,
      nowMs,
    },)
    : projectUsagePercent({
      snapshot,
      previousSnapshot,
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

/**
 * Converts snapshots into a map keyed by limiter family.
 *
 * @param snapshots - parsed limiter snapshots
 *
 * @returns map keyed by snapshot key
 *
 * @example
 * ```ts
 * snapshotsToMap(parseRateLimitSnapshots({ headers, nowMs }));
 * ```
 */
function snapshotsToMap(
  snapshots: readonly RateLimitSnapshot[],
): ReadonlyMap<string, RateLimitSnapshot> {
  /**
   * Mutable map populated from latest valid snapshots.
   */
  const map = new Map<string, RateLimitSnapshot>();

  snapshots.forEach(function addSnapshot(snapshot,): void {
    map.set(
      snapshot.key,
      snapshot,
    );
  },);

  return map;
}

//endregion Segment formatting

//region Public formatter

/**
 * Formats Pi footer status text from provider response headers.
 *
 * @param headers - provider response headers from Pi
 *
 * @param previousSnapshots - prior valid samples keyed by limiter family
 *
 * @param nowMs - current timestamp in epoch milliseconds
 *
 * @param style - theme style hooks
 *
 * @returns status text plus latest snapshots for next projection pass
 *
 * @example
 * ```ts
 * const result = formatUsageWarningStatus({ headers, previousSnapshots, nowMs: Date.now(), style });
 * ```
 */
function formatUsageWarningStatus({
  headers,
  previousSnapshots,
  nowMs,
  style,
}: Readonly<{
  headers: Readonly<Record<string, string>>;
  previousSnapshots: ReadonlyMap<string, RateLimitSnapshot>;
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
      /**
       * Prior sample for this limiter, if one was captured on an earlier response.
       */
      const previousSnapshot = previousSnapshots.get(snapshot.key,);
      if (previousSnapshot === undefined) {
        return formatUsageWarningSegment({
          snapshot,
          nowMs,
          style,
        },);
      }

      return formatUsageWarningSegment({
        snapshot,
        previousSnapshot,
        nowMs,
        style,
      },);
    },)
    .filter(function keepSegment(segment,): boolean {
      return isNonEmptySegment(segment,);
    },);

  return {
    statusText: segments.join(' · ',),
    snapshots: snapshotsToMap(snapshots,),
  };
}

//endregion Public formatter

export {
  formatRelativeTime,
  formatUsageWarningSegment,
  formatUsageWarningStatus,
  projectUsagePercent,
};
