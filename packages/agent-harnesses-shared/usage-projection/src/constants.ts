/**
 * Usage projection thresholds and time constants.
 *
 * @module
 */

//region Numeric constants

/**
 * Percentage scale used by usage math.
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
 * Days in one week.
 */
const DAYS_PER_WEEK = 7;

/**
 * Seconds in one week.
 */
const SECONDS_PER_WEEK: number = DAYS_PER_WEEK * SECONDS_PER_DAY;

/**
 * Remaining-capacity cutoff where statusline warnings become visible.
 */
const RATE_LIMIT_REMAINING_THRESHOLD = 50;

/**
 * Remaining-capacity cutoff for red severity.
 */
const RATE_LIMIT_CRITICAL_THRESHOLD = 10;

/**
 * Remaining-capacity cutoff for yellow severity.
 */
const RATE_LIMIT_CAUTION_THRESHOLD = 25;

/**
 * Projected usage cutoff where statusline warnings show an overrun marker.
 */
const PROJECTED_OVERRUN_THRESHOLD = 100;

/**
 * Minimum current used percentage before projection starts.
 *
 * Tiny samples near the beginning of a limiter can explode under division.
 */
const MIN_USAGE_PERCENT_FOR_PROJECTION = 5;

/**
 * Minimum elapsed sample interval before projection starts.
 *
 * Provider responses can arrive in quick succession,
 * and sub-second deltas are too noisy for a burn-rate warning.
 */
const MIN_PROJECTION_ELAPSED_SECONDS = 1;

//endregion Numeric constants

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
};
