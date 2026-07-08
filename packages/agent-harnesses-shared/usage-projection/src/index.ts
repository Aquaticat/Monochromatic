/**
 * Shared usage projection and rate-limit status formatting.
 *
 * @module
 */

export {
  MILLISECONDS_PER_SECOND,
  MIN_PROJECTION_ELAPSED_SECONDS,
  MIN_USAGE_PERCENT_FOR_PROJECTION,
  PERCENT_BASE,
  PROJECTED_OVERRUN_THRESHOLD,
  RATE_LIMIT_CAUTION_THRESHOLD,
  RATE_LIMIT_CRITICAL_THRESHOLD,
  RATE_LIMIT_REMAINING_THRESHOLD,
  SECONDS_PER_DAY,
  SECONDS_PER_HOUR,
  SECONDS_PER_MINUTE,
  SECONDS_PER_WEEK,
} from './constants.ts';
export {
  formatRateLimitSegment,
  formatRateLimitStatus,
  isNonEmptySegment,
} from './format.ts';
export {
  formatProjectionMarker,
  projectUsagePercent,
} from './projection.ts';
export {
  rateLimitSeverity,
  remainingPercent,
  styleBySeverity,
} from './severity.ts';
export {
  PLAIN_RATE_LIMIT_STYLE,
  identityStyle,
} from './style.ts';
export { formatRelativeTime, } from './time.ts';
export type {
  RateLimitSeverity,
  RateLimitSnapshot,
  RateLimitStatus,
  RateLimitStyle,
} from './types.ts';
