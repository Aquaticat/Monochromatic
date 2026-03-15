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

import type { ISOTimestamp, } from './runner-types.ts';

/** OpenRouter models endpoint -- lightweight, public, no auth required */
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

/** Maximum milliseconds to wait for the HEAD request before falling back to local clock */
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
  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: 'HEAD',
      signal: AbortSignal.timeout(TIMEOUT_MS,),
    },);
    const dateHeader = response.headers.get('date',);
    if (dateHeader !== null) {
      const parsed = new Date(dateHeader,);
      if (!Number.isNaN(parsed.getTime(),))
        return parsed.toISOString() as ISOTimestamp;
    }
    console.warn(
      '[server-time] Date header missing or unparseable, falling back to local clock',
    );
  }
  catch (error) {
    console.warn(
      `[server-time] HEAD request failed, falling back to local clock: ${String(error,)}`,
    );
  }
  return new Date().toISOString() as ISOTimestamp;
}
