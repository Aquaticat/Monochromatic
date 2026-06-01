/**
 * Shared projected-overflow warning types and thresholds.
 *
 * @module
 */

//region Numeric constants

/**
 * Percentage scale used by provider usage math.
 */
const PERCENT_BASE = 100;

/**
 * Milliseconds in one second.
 */
const MILLISECONDS_PER_SECOND = 1_000;

/**
 * Seconds in one minute.
 */
const SECONDS_PER_MINUTE = 60;

/**
 * Anthropic token rate-limit header window in seconds.
 *
 * Anthropic's Messages API token limits are per-minute ITPM and OTPM limits;
 * the header reset timestamp marks when that token bucket fully replenishes.
 */
const RATE_LIMIT_WINDOW_SECONDS: number = SECONDS_PER_MINUTE;

/**
 * Seconds in one hour.
 */
const SECONDS_PER_HOUR = 3_600;

/**
 * Seconds in one day.
 */
const SECONDS_PER_DAY = 86_400;

/**
 * Days in one week.
 */
const DAYS_PER_WEEK = 7;

/**
 * Seconds in one week.
 */
const SECONDS_PER_WEEK: number = DAYS_PER_WEEK * SECONDS_PER_DAY;

/**
 * Projected usage cutoff where the extension warns about overflow.
 */
const PROJECTED_OVERFLOW_THRESHOLD = 100;

/**
 * Minimum current used percentage before projection starts.
 *
 * A tiny sample near the beginning of a limiter can explode under division.
 */
const MIN_USAGE_PERCENT_FOR_PROJECTION = 5;

/**
 * Minimum elapsed sample interval before projection starts.
 *
 * Provider responses can arrive in quick succession, and sub-second deltas are
 * too noisy for a burn-rate warning.
 */
const MIN_PROJECTION_ELAPSED_SECONDS = 1;

//endregion Numeric constants

//region Types

/**
 * Header group describing one Anthropic token rate limiter.
 */
type RateLimitHeaderFamily = {
  /**
   * Stable key for the limiter family.
   */
  readonly key: string;
  /**
   * Short footer label shown before the projected warning text.
   */
  readonly label: string;
  /**
   * Header carrying limiter capacity.
   */
  readonly limitHeader: string;
  /**
   * Header carrying remaining capacity.
   */
  readonly remainingHeader: string;
  /**
   * Header carrying RFC 3339 reset timestamp.
   */
  readonly resetHeader: string;
  /**
   * Fixed limiter window duration in seconds.
   */
  readonly windowSeconds: number;
};

/**
 * Parsed provider usage window sampled from one provider response.
 */
type RateLimitSnapshot = {
  /**
   * Stable key for this sampled window.
   */
  readonly key: string;
  /**
   * Short footer label shown before the projected warning text.
   */
  readonly label: string;
  /**
   * Reset timestamp in Unix epoch milliseconds.
   */
  readonly resetAtMs: number;
  /**
   * Fixed limiter window duration in seconds.
   */
  readonly windowSeconds: number;
  /**
   * Optional elapsed-pace multiplier for providers whose quota window regenerates fractionally.
   */
  readonly paceScale: number;
  /**
   * Wall-clock sample time in Unix epoch milliseconds.
   */
  readonly sampledAtMs: number;
  /**
   * Used capacity as a percentage of capacity.
   */
  readonly usedPercent: number;
};

/**
 * Theme hooks used to color footer warning segments.
 */
type UsageWarningStyle = {
  /**
   * Style for projected-overflow warnings.
   */
  readonly overflow: (text: string,) => string;
};

/**
 * Formatting result returned after inspecting response headers.
 */
type UsageWarningStatus = {
  /**
   * Footer status text. Empty string means the status should be cleared.
   */
  readonly statusText: string;
};

//endregion Types

//region Plain style

/**
 * Returns text unchanged.
 *
 * @param text - value to return unchanged
 *
 * @returns original text
 *
 * @example
 * ```ts
 * identityStyle('warning');
 * ```
 */
function identityStyle(text: string,): string {
  return text;
}

/**
 * Style object used by tests and non-UI execution paths.
 */
const PLAIN_USAGE_WARNING_STYLE: UsageWarningStyle = {
  overflow: identityStyle,
};

//endregion Plain style

export {
  MILLISECONDS_PER_SECOND,
  MIN_PROJECTION_ELAPSED_SECONDS,
  MIN_USAGE_PERCENT_FOR_PROJECTION,
  PERCENT_BASE,
  PLAIN_USAGE_WARNING_STYLE,
  PROJECTED_OVERFLOW_THRESHOLD,
  RATE_LIMIT_WINDOW_SECONDS,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  SECONDS_PER_WEEK,
};
export type {
  RateLimitHeaderFamily,
  RateLimitSnapshot,
  UsageWarningStatus,
  UsageWarningStyle,
};
