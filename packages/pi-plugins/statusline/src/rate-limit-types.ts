/**
 * Pi rate-limit parser types and shared projection re-exports.
 *
 * @module
 */

import {
  SECONDS_PER_MINUTE,
} from '@monochromatic-dev/agent-harness-shared-usage-projection/ts';

/**
 * Anthropic token rate-limit header window in seconds.
 *
 * Anthropic's Messages API token limits are per-minute ITPM and OTPM limits;
 * the header reset timestamp marks when that token bucket fully replenishes.
 */
const RATE_LIMIT_WINDOW_SECONDS: number = SECONDS_PER_MINUTE;

/**
 * Header group describing one Anthropic token rate limiter.
 */
type RateLimitHeaderFamily = {
  /**
   * Stable key for the limiter family.
   */
  readonly key: string;
  /**
   * Short footer label shown before rate-limit warning text.
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

export {
  MILLISECONDS_PER_SECOND,
  MIN_PROJECTION_ELAPSED_SECONDS,
  MIN_USAGE_PERCENT_FOR_PROJECTION,
  PERCENT_BASE,
  PLAIN_RATE_LIMIT_STYLE as PLAIN_USAGE_WARNING_STYLE,
  PROJECTED_OVERRUN_THRESHOLD as PROJECTED_OVERFLOW_THRESHOLD,
  RATE_LIMIT_CAUTION_THRESHOLD,
  RATE_LIMIT_CRITICAL_THRESHOLD,
  RATE_LIMIT_REMAINING_THRESHOLD,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  SECONDS_PER_WEEK,
} from '@monochromatic-dev/agent-harness-shared-usage-projection/ts';

export { RATE_LIMIT_WINDOW_SECONDS, };

export type {
  RateLimitSnapshot,
  RateLimitStatus as UsageWarningStatus,
  RateLimitStyle as UsageWarningStyle,
} from '@monochromatic-dev/agent-harness-shared-usage-projection/ts';

export type { RateLimitHeaderFamily, };
