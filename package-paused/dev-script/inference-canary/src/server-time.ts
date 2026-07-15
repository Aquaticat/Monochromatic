/**
 * Fetches an authoritative timestamp from the OpenRouter API server.
 *
 * Local system clocks can be wrong (timezone misconfiguration, NTP drift, VM clock skew).
 * A single HEAD request to the OpenRouter models endpoint extracts the standard HTTP
 * `Date` header, giving a server-side timestamp from infrastructure the canary already
 * depends on. Falls back to the local clock if the request fails.
 *
 * @example
 * ```ts
 * const timestamp = await fetchServerTimestamp();
 * // "2026-02-28T12:00:00.000Z"
 * ```
 */

import {
  l,
  tagged,
} from './log.ts';

import type { ISOTimestamp, } from './runner-types.ts';

/**
 * OpenRouter models endpoint: lightweight, public, no auth required
 */
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

/**
 * Maximum milliseconds to wait for the HEAD request before falling back to local clock
 */
const TIMEOUT_MS = 5_000;

/**
 * Fetches an authoritative ISO 8601 timestamp from the OpenRouter API server.
 *
 * Sends a HEAD request to the public models endpoint and extracts the `Date`
 * response header. Falls back to the local system clock if the request fails
 * or times out, logging a warning so clock issues are visible in run logs.
 *
 * @returns ISO 8601 timestamp from the server, or local fallback
 *
 * @example
 * ```ts
 * const ts = await fetchServerTimestamp();
 * // "2026-02-28T12:34:56.000Z"
 * ```
 */
export async function fetchServerTimestamp(): Promise<ISOTimestamp> {
  /**
   * Server-time logger for fallback warnings.
   */
  const rl = tagged({
    tag: fetchServerTimestamp.name,
    l,
  },);
  try {
    /**
     * HEAD response from the OpenRouter models endpoint; only the `date` header is consumed.
     */
    const response = await fetch(
      OPENROUTER_MODELS_URL,
      {
        method: 'HEAD',
        signal: AbortSignal.timeout(TIMEOUT_MS,),
      },
    );
    /**
     * Raw RFC 7231 `Date` header from the response; null when the server omitted it.
     */
    const dateHeader = response.headers
      .get('date',);
    if (dateHeader !== null) {
      /**
       * Parsed `Date` instance; checked for NaN below before being serialized as ISO 8601.
       */
      const parsed = new Date(dateHeader,);
      if (!Number.isNaN(parsed.getTime(),)) {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ISOTimestamp is a branded string; toISOString() always produces a valid ISO 8601 value
        return parsed.toISOString() as ISOTimestamp;
      }
    }
    rl.warn('Date header missing or unparseable, falling back to local clock',);
  }
  catch (error) {
    rl.warn(
      `HEAD request failed, falling back to local clock: ${String(error,)}`,
    );
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- ISOTimestamp is a branded string; toISOString() always produces a valid ISO 8601 value
  return new Date().toISOString() as ISOTimestamp;
}
