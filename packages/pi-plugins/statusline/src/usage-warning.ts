/**
 * Pi provider usage header fan-in and shared status formatting.
 *
 * @module
 */

import {
  formatRateLimitSegment,
  formatRateLimitStatus,
  formatRelativeTime as formatSharedRelativeTime,
  projectUsagePercent as projectSharedUsagePercent,
} from '@monochromatic-dev/agent-harness-shared-usage-projection/ts';

import { parseRateLimitSnapshots, } from './rate-limit-headers.ts';
import type {
  RateLimitSnapshot,
  UsageWarningStatus,
  UsageWarningStyle,
} from './rate-limit-types.ts';

//region Compatibility wrappers

/**
 * Formats milliseconds until reset as a compact relative duration.
 *
 * @param resetAtMs - reset timestamp in epoch milliseconds
 *
 * @param nowMs - render timestamp in epoch milliseconds
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
  return formatSharedRelativeTime({
    resetAtMs,
    renderedAtMs: nowMs,
  },);
}

/**
 * Projects usage at fixed window end through the shared policy.
 *
 * @param snapshot - current limiter sample
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
}: Readonly<{
  snapshot: RateLimitSnapshot;
  nowMs?: number;
}>,): number {
  return projectSharedUsagePercent({ snapshot, },);
}

//endregion Compatibility wrappers

//region Segment compatibility wrapper

/**
 * Formats one Pi usage-warning segment through the shared policy.
 *
 * @param snapshot - current limiter sample
 *
 * @param nowMs - render timestamp in epoch milliseconds
 *
 * @param style - host style callbacks
 *
 * @returns footer segment, or empty string when shared policy hides it
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
  return formatRateLimitSegment({
    snapshot,
    renderedAtMs: nowMs,
    style,
  },);
}

//endregion Segment compatibility wrapper

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
 * @returns {@link UsageWarningStatus} for rate-limit warnings
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

  return formatRateLimitStatus({
    snapshots,
    renderedAtMs: nowMs,
    style,
  },);
}

//endregion Public formatter

export {
  formatRelativeTime,
  formatUsageWarningSegment,
  formatUsageWarningStatus,
  projectUsagePercent,
};
