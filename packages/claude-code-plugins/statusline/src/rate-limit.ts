/**
 * Claude rate-limit payload adapter for shared usage projection.
 *
 * @module
 */

import {
  formatRateLimitStatus,
  type RateLimitSnapshot,
  type RateLimitStatus,
  type RateLimitStyle,
} from '@monochromatic-dev/agent-harness-shared-usage-projection/ts';

import {
  GREEN,
  RED,
  YELLOW,
  color,
} from './ansi.ts';
import type {
  RateLimitTier,
  StatuslineInput,
} from './types.ts';

//region Constants

/**
 * Milliseconds in one second for Claude epoch-second reset values.
 */
const MILLISECONDS_PER_SECOND = 1_000;

/**
 * Seconds in one hour.
 */
const SECONDS_PER_HOUR = 3_600;

/**
 * Seconds in one day.
 */
const SECONDS_PER_DAY = 86_400;

/**
 * Hour count in the short Claude session limit window.
 */
const FIVE_HOUR_COUNT = 5;

/**
 * Day count in the long Claude subscription limit window.
 */
const DAYS_PER_WEEK = 7;

/**
 * Length of the five-hour rate-limit window in seconds.
 */
const FIVE_HOUR_WINDOW_SECONDS: number = FIVE_HOUR_COUNT * SECONDS_PER_HOUR;

/**
 * Length of the seven-day rate-limit window in seconds.
 */
const SEVEN_DAY_WINDOW_SECONDS: number = DAYS_PER_WEEK * SECONDS_PER_DAY;

/**
 * Sentinel used before Claude tier data is converted to a snapshot.
 */
const RATE_LIMIT_TIER_NOT_FOUND: unique symbol = Symbol('claude statusline rate-limit tier not found',);

/**
 * Invalid or absent Claude rate-limit tier sentinel type.
 */
type RateLimitTierNotFound = typeof RATE_LIMIT_TIER_NOT_FOUND;

/**
 * Sentinel returned when Claude's statusline JSON lacks a usable rate-limit tier.
 */
const RATE_LIMIT_SNAPSHOT_NOT_FOUND: unique symbol = Symbol('claude statusline rate-limit snapshot not found',);

/**
 * Invalid or absent Claude rate-limit snapshot sentinel type.
 */
type RateLimitSnapshotNotFound = typeof RATE_LIMIT_SNAPSHOT_NOT_FOUND;

/**
 * ANSI style callbacks for shared rate-limit formatting.
 */
const CLAUDE_RATE_LIMIT_STYLE: RateLimitStyle = {
  green: function green(value: string,): string {
    return color({
      code: GREEN,
      value,
    },);
  },
  yellow: function yellow(value: string,): string {
    return color({
      code: YELLOW,
      value,
    },);
  },
  red: function red(value: string,): string {
    return color({
      code: RED,
      value,
    },);
  },
};

//endregion Constants

//region Snapshot adapter

/**
 * Converts one Claude rate-limit tier into a shared snapshot.
 *
 * @param key - stable snapshot key
 *
 * @param tier - rate-limit tier payload or invalid sentinel
 *
 * @param windowSeconds - fixed window duration in seconds
 *
 * @param sampledAtMs - sample timestamp in epoch milliseconds
 *
 * @returns shared snapshot, or {@link RATE_LIMIT_SNAPSHOT_NOT_FOUND} when tier data is missing
 *
 * @example
 * ```ts
 * rateLimitSnapshot({ key: 'five-hour', tier, windowSeconds: FIVE_HOUR_WINDOW_SECONDS, sampledAtMs: Date.now() });
 * ```
 */
function rateLimitSnapshot({
  key,
  tier,
  windowSeconds,
  sampledAtMs,
}: Readonly<{
  key: string;
  tier: RateLimitTier | RateLimitTierNotFound;
  windowSeconds: number;
  sampledAtMs: number;
}>,): RateLimitSnapshot | RateLimitSnapshotNotFound {
  if (tier === RATE_LIMIT_TIER_NOT_FOUND)
    return RATE_LIMIT_SNAPSHOT_NOT_FOUND;
  if (tier.used_percentage === undefined)
    return RATE_LIMIT_SNAPSHOT_NOT_FOUND;
  if (tier.resets_at === undefined)
    return RATE_LIMIT_SNAPSHOT_NOT_FOUND;
  if (!Number.isFinite(tier.used_percentage,))
    return RATE_LIMIT_SNAPSHOT_NOT_FOUND;
  if (!Number.isFinite(tier.resets_at,))
    return RATE_LIMIT_SNAPSHOT_NOT_FOUND;

  return {
    key,
    label: '',
    resetAtMs: tier.resets_at * MILLISECONDS_PER_SECOND,
    windowSeconds,
    paceScale: 1,
    sampledAtMs,
    usedPercent: tier.used_percentage,
  };
}

/**
 * Detects valid shared rate-limit snapshots.
 *
 * @param snapshot - candidate snapshot or invalid sentinel
 *
 * @returns whether snapshot can be formatted
 *
 * @example
 * ```ts
 * isRateLimitSnapshot(RATE_LIMIT_SNAPSHOT_NOT_FOUND);
 * ```
 */
function isRateLimitSnapshot(
  snapshot: RateLimitSnapshot | RateLimitSnapshotNotFound,
): snapshot is RateLimitSnapshot {
  return snapshot !== RATE_LIMIT_SNAPSHOT_NOT_FOUND;
}

/**
 * Converts optional Claude tier payload to explicit sentinel form.
 *
 * @param tier - optional Claude rate-limit tier
 *
 * @returns concrete tier or invalid sentinel
 *
 * @example
 * ```ts
 * tierOrNotFound(undefined);
 * ```
 */
function tierOrNotFound(tier?: RateLimitTier,): RateLimitTier | RateLimitTierNotFound {
  return tier ?? RATE_LIMIT_TIER_NOT_FOUND;
}

//endregion Snapshot adapter

//region Public formatter

/**
 * Formats Claude statusline rate-limit tiers through the shared formatter.
 *
 * @param rateLimits - rate-limit payload from Claude statusline JSON
 *
 * @param sampledAtMs - sample timestamp in epoch milliseconds
 *
 * @param renderedAtMs - render timestamp in epoch milliseconds
 *
 * @returns formatted rate-limit statusline segment
 *
 * @example
 * ```ts
 * formatRateLimits({ rateLimits: input.rate_limits, sampledAtMs: Date.now(), renderedAtMs: Date.now() });
 * ```
 */
function formatRateLimits({
  rateLimits,
  sampledAtMs,
  renderedAtMs,
}: Readonly<{
  rateLimits?: StatuslineInput['rate_limits'];
  sampledAtMs: number;
  renderedAtMs: number;
}>,): string {
  /**
   * Five-hour tier in explicit sentinel form.
   */
  const fiveHourTier = rateLimits === undefined
    ? RATE_LIMIT_TIER_NOT_FOUND
    : tierOrNotFound(rateLimits.five_hour,);
  /**
   * Seven-day tier in explicit sentinel form.
   */
  const sevenDayTier = rateLimits === undefined
    ? RATE_LIMIT_TIER_NOT_FOUND
    : tierOrNotFound(rateLimits.seven_day,);
  /**
   * Snapshot candidates in Claude's display order.
   */
  const candidates: readonly (RateLimitSnapshot | RateLimitSnapshotNotFound)[] = [
    rateLimitSnapshot({
      key: 'five-hour',
      tier: fiveHourTier,
      windowSeconds: FIVE_HOUR_WINDOW_SECONDS,
      sampledAtMs,
    },),
    rateLimitSnapshot({
      key: 'seven-day',
      tier: sevenDayTier,
      windowSeconds: SEVEN_DAY_WINDOW_SECONDS,
      sampledAtMs,
    },),
  ];
  /**
   * Shared snapshots in Claude's display order.
   */
  const snapshots = candidates.filter(function keepSnapshot(snapshot,): snapshot is RateLimitSnapshot {
    return isRateLimitSnapshot(snapshot,);
  },);
  /**
   * Shared formatter result.
   */
  const status: RateLimitStatus = formatRateLimitStatus({
    snapshots,
    renderedAtMs,
    style: CLAUDE_RATE_LIMIT_STYLE,
  },);

  return status.statusText;
}

//endregion Public formatter

export {
  FIVE_HOUR_WINDOW_SECONDS,
  RATE_LIMIT_SNAPSHOT_NOT_FOUND,
  RATE_LIMIT_TIER_NOT_FOUND,
  SEVEN_DAY_WINDOW_SECONDS,
  formatRateLimits,
  isRateLimitSnapshot,
  rateLimitSnapshot,
  tierOrNotFound,
};
export type {
  RateLimitSnapshotNotFound,
  RateLimitTierNotFound,
};
