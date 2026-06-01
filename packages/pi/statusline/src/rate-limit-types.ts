/**
 * Shared rate-limit warning types and thresholds.
 *
 * @module
 */

//region Numeric constants

/**
 * Percentage scale used by Anthropic usage math.
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
 * Seconds in one hour.
 */
const SECONDS_PER_HOUR = 3_600;

/**
 * Seconds in one day.
 */
const SECONDS_PER_DAY = 86_400;

/**
 * Remaining-capacity cutoff where a rate-limit segment becomes visible.
 */
const RATE_LIMIT_REMAINING_THRESHOLD = 50;

/**
 * Remaining-capacity cutoff where warning color starts.
 */
const CAUTION_REMAINING_THRESHOLD = 25;

/**
 * Remaining-capacity cutoff where critical color starts.
 */
const CRITICAL_REMAINING_THRESHOLD = 10;

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
 * Header group describing one Anthropic rate limiter.
 */
type RateLimitHeaderFamily = {
  /**
   * Stable key for matching samples across provider responses.
   */
  readonly key: string;
  /**
   * Short footer label shown before the warning text.
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
};

/**
 * Parsed limiter state sampled from one provider response.
 */
type RateLimitSnapshot = {
  /**
   * Stable key from {@link RateLimitHeaderFamily.key}.
   */
  readonly key: string;
  /**
   * Short footer label from {@link RateLimitHeaderFamily.label}.
   */
  readonly label: string;
  /**
   * Limiter capacity parsed from the `*-limit` header.
   */
  readonly limit: number;
  /**
   * Remaining capacity clamped between zero and {@link limit}.
   */
  readonly remaining: number;
  /**
   * Reset timestamp in Unix epoch milliseconds.
   */
  readonly resetAtMs: number;
  /**
   * Wall-clock sample time in Unix epoch milliseconds.
   */
  readonly sampledAtMs: number;
  /**
   * Used capacity as a percentage of {@link limit}.
   */
  readonly usedPercent: number;
  /**
   * Remaining capacity as a floored whole percentage.
   */
  readonly remainingPercent: number;
};

/**
 * Theme hooks used to color footer warning segments.
 */
type UsageWarningStyle = {
  /**
   * Style for visible but non-critical remaining-capacity warnings.
   */
  readonly healthy: (text: string,) => string;
  /**
   * Style for low remaining-capacity warnings.
   */
  readonly caution: (text: string,) => string;
  /**
   * Style for critical or projected-overflow warnings.
   */
  readonly critical: (text: string,) => string;
};

/**
 * Formatting result returned after inspecting response headers.
 */
type UsageWarningStatus = {
  /**
   * Footer status text. Empty string means the status should be cleared.
   */
  readonly statusText: string;
  /**
   * Latest valid snapshots keyed by limiter family.
   */
  readonly snapshots: ReadonlyMap<string, RateLimitSnapshot>;
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
  healthy: identityStyle,
  caution: identityStyle,
  critical: identityStyle,
};

//endregion Plain style

export {
  CAUTION_REMAINING_THRESHOLD,
  CRITICAL_REMAINING_THRESHOLD,
  MILLISECONDS_PER_SECOND,
  MIN_PROJECTION_ELAPSED_SECONDS,
  MIN_USAGE_PERCENT_FOR_PROJECTION,
  PERCENT_BASE,
  PLAIN_USAGE_WARNING_STYLE,
  PROJECTED_OVERFLOW_THRESHOLD,
  RATE_LIMIT_REMAINING_THRESHOLD,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
};
export type {
  RateLimitHeaderFamily,
  RateLimitSnapshot,
  UsageWarningStatus,
  UsageWarningStyle,
};
