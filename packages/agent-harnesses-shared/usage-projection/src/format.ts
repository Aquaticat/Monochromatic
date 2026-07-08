/**
 * Shared rate-limit segment and status formatting.
 *
 * @module
 */

import {
  PROJECTED_OVERRUN_THRESHOLD,
  RATE_LIMIT_REMAINING_THRESHOLD,
} from './constants.ts';
import {
  formatProjectionMarker,
  projectUsagePercent,
} from './projection.ts';
import {
  rateLimitSeverity,
  remainingPercent,
  styleBySeverity,
} from './severity.ts';
import { formatRelativeTime, } from './time.ts';
import type {
  RateLimitSnapshot,
  RateLimitStatus,
  RateLimitStyle,
} from './types.ts';

//region Segment formatting

/**
 * Formats one rate-limit status segment.
 *
 * @param snapshot - current limiter sample
 *
 * @param renderedAtMs - render timestamp in epoch milliseconds
 *
 * @param style - host style callbacks
 *
 * @returns status segment, or empty string when policy says to hide it
 *
 * @example
 * ```ts
 * formatRateLimitSegment({ snapshot, renderedAtMs: Date.now(), style });
 * ```
 */
function formatRateLimitSegment({
  snapshot,
  renderedAtMs,
  style,
}: Readonly<{
  snapshot: RateLimitSnapshot;
  renderedAtMs: number;
  style: RateLimitStyle;
}>,): string {
  /**
   * Projected used percentage at fixed window end.
   */
  const projectedPercent = projectUsagePercent({ snapshot, },);
  /**
   * Remaining capacity percentage.
   */
  const remaining = remainingPercent(snapshot,);
  /**
   * Whether projection alone forces this segment to render.
   */
  const isProjectedOverrun = projectedPercent > PROJECTED_OVERRUN_THRESHOLD;

  if ((remaining > RATE_LIMIT_REMAINING_THRESHOLD) && (!isProjectedOverrun))
    return '';

  /**
   * Inline annotation showing projected end-of-window usage.
   */
  const overrunMarker = isProjectedOverrun
    ? ` ${formatProjectionMarker(projectedPercent,)}`
    : '';
  /**
   * Selected shared severity.
   */
  const severity = rateLimitSeverity({
    remaining,
    projectedPercent,
  },);
  /**
   * Styled remaining-capacity text and optional projection marker.
   */
  const remainingText = styleBySeverity({
    text: `${remaining}% left${overrunMarker}`,
    severity,
    style,
  },);
  /**
   * Host label for this rate-limit segment.
   */
  const { label, } = snapshot;
  /**
   * Whether host supplied a label prefix.
   */
  const hasLabel = label.length > 0;
  /**
   * Optional host label prefix.
   */
  const labelPrefix = hasLabel
    ? `${label} `
    : '';
  /**
   * Human-readable duration until this usage window resets or replenishes.
   */
  const timeLeft = formatRelativeTime({
    resetAtMs: snapshot.resetAtMs,
    renderedAtMs,
  },);

  return `${labelPrefix}${remainingText} (${timeLeft})`;
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
 * isNonEmptySegment('50% left');
 * ```
 */
function isNonEmptySegment(segment: string,): boolean {
  return segment.length > 0;
}

//endregion Segment formatting

//region Public formatter

/**
 * Formats status text from rate-limit snapshots.
 *
 * @param snapshots - parsed rate-limit samples
 *
 * @param renderedAtMs - render timestamp in epoch milliseconds
 *
 * @param style - host style callbacks
 *
 * @returns {@link RateLimitStatus} for rate-limit warnings
 *
 * @example
 * ```ts
 * formatRateLimitStatus({ snapshots, renderedAtMs: Date.now(), style });
 * ```
 */
function formatRateLimitStatus({
  snapshots,
  renderedAtMs,
  style,
}: Readonly<{
  snapshots: readonly RateLimitSnapshot[];
  renderedAtMs: number;
  style: RateLimitStyle;
}>,): RateLimitStatus {
  /**
   * Formatted segments that should appear in the statusline.
   */
  const segments = snapshots
    .map(function formatSnapshot(snapshot,): string {
      return formatRateLimitSegment({
        snapshot,
        renderedAtMs,
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
  formatRateLimitSegment,
  formatRateLimitStatus,
  isNonEmptySegment,
};
