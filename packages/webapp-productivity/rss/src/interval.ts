import { $ as tagged, } from '@monochromatic-dev/module-es/tagged';
import { z, } from 'zod/v4-mini';
import { l as parentLogger, } from './log.ts';

/** Tagged logger for the interval module. */
const l = tagged({ tag: 'interval', l: parentLogger, },);

/** Minutes per fetch interval window. */
const MINUTES_PER_INTERVAL = 5;

/** Seconds per minute. */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second. */
const MS_PER_SECOND = 1_000;

/** Default fetch cache interval: 5 minutes in milliseconds. */
const DEFAULT_FETCH_INTERVAL_MS = MINUTES_PER_INTERVAL * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Duration in milliseconds for which fetched feed data is cached.
 * Controls the time bucket size for the fetch memoize salt.
 * Override with the `RSS_FETCH_INTERVAL_MS` environment variable.
 *
 * @see `getFetchSalt` for how this controls cache invalidation
 */
export const FETCH_INTERVAL_MS: number = z.coerce.number().parse(
  process.env.RSS_FETCH_INTERVAL_MS ?? DEFAULT_FETCH_INTERVAL_MS,
);

l.debug(`fetch interval: ${String(FETCH_INTERVAL_MS)}ms`);

/**
 * Computes a time-bucketed salt for fetch memoization.
 * Returns the same value within each interval window,
 * causing fetch results to be reused until the window advances.
 *
 * @returns String representation of the current time bucket
 */
export function getFetchSalt(): string {
  return String(Math.floor(Date.now() / FETCH_INTERVAL_MS),);
}
