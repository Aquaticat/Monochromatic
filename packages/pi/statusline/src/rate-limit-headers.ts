/**
 * Anthropic rate-limit response header parsing.
 *
 * @module
 */

import {
  PERCENT_BASE,
  type RateLimitHeaderFamily,
  type RateLimitSnapshot,
} from './rate-limit-types.ts';

//region Header families

/**
 * Anthropic header groups that describe token usage capacity.
 *
 * Request-count headers are intentionally omitted because this extension ports
 * usage-capacity warnings, not request throughput warnings.
 */
const RATE_LIMIT_HEADER_FAMILIES: readonly RateLimitHeaderFamily[] = [
  {
    key: 'tokens',
    label: 'tokens',
    limitHeader: 'anthropic-ratelimit-tokens-limit',
    remainingHeader: 'anthropic-ratelimit-tokens-remaining',
    resetHeader: 'anthropic-ratelimit-tokens-reset',
  },
  {
    key: 'input',
    label: 'input',
    limitHeader: 'anthropic-ratelimit-input-tokens-limit',
    remainingHeader: 'anthropic-ratelimit-input-tokens-remaining',
    resetHeader: 'anthropic-ratelimit-input-tokens-reset',
  },
  {
    key: 'output',
    label: 'output',
    limitHeader: 'anthropic-ratelimit-output-tokens-limit',
    remainingHeader: 'anthropic-ratelimit-output-tokens-remaining',
    resetHeader: 'anthropic-ratelimit-output-tokens-reset',
  },
  {
    key: 'unified',
    label: 'unified',
    limitHeader: 'anthropic-ratelimit-unified-tokens-limit',
    remainingHeader: 'anthropic-ratelimit-unified-tokens-remaining',
    resetHeader: 'anthropic-ratelimit-unified-tokens-reset',
  },
  {
    key: 'priority-input',
    label: 'priority input',
    limitHeader: 'anthropic-priority-input-tokens-limit',
    remainingHeader: 'anthropic-priority-input-tokens-remaining',
    resetHeader: 'anthropic-priority-input-tokens-reset',
  },
  {
    key: 'priority-output',
    label: 'priority output',
    limitHeader: 'anthropic-priority-output-tokens-limit',
    remainingHeader: 'anthropic-priority-output-tokens-remaining',
    resetHeader: 'anthropic-priority-output-tokens-reset',
  },
];

//endregion Header families

//region Parsing helpers

/**
 * Sentinel returned when a header value is missing or invalid.
 */
const INVALID_HEADER_VALUE = Symbol('invalidHeaderValue',);

/**
 * Sentinel returned when a header family cannot produce a snapshot.
 */
const INVALID_RATE_LIMIT_SNAPSHOT = Symbol('invalidRateLimitSnapshot',);

/**
 * Invalid header value sentinel type.
 */
type InvalidHeaderValue = typeof INVALID_HEADER_VALUE;

/**
 * Invalid snapshot sentinel type.
 */
type InvalidRateLimitSnapshot = typeof INVALID_RATE_LIMIT_SNAPSHOT;

/**
 * Normalizes provider headers to lowercase names.
 *
 * @param headers - provider response headers from Pi
 *
 * @returns header record keyed by lowercase header names
 *
 * @example
 * ```ts
 * normalizeHeaders({ 'Anthropic-Ratelimit-Tokens-Limit': '1000' });
 * ```
 */
function normalizeHeaders(
  headers: Readonly<Record<string, string>>,
): Record<string, string> {
  /**
   * Mutable accumulator filled with lowercase header names.
   */
  const normalizedHeaders: Record<string, string> = {};

  for (const entry of Object.entries(headers,)) {
    /**
     * Header name and value before case normalization.
     */
    const [name, value,] = entry;
    normalizedHeaders[name.toLowerCase()] = value;
  }

  return normalizedHeaders;
}

/**
 * Parses a non-negative numeric header.
 *
 * @param headers - lowercase provider response headers
 *
 * @param headerName - lowercase header name to parse
 *
 * @returns numeric value, or invalid sentinel when missing or invalid
 *
 * @example
 * ```ts
 * parseNumberHeader({ headers: { count: '10' }, headerName: 'count' });
 * ```
 */
function parseNumberHeader({
  headers,
  headerName,
}: Readonly<{
  headers: Readonly<Record<string, string>>;
  headerName: string;
}>,): number | InvalidHeaderValue {
  /**
   * Raw header value, if the provider supplied it.
   */
  const rawValue = headers[headerName];
  if (rawValue === undefined)
    return INVALID_HEADER_VALUE;

  /**
   * Numeric header value parsed from the raw string.
   */
  const value = Number(rawValue,);
  if ((!Number.isFinite(value,)) || (value < 0))
    return INVALID_HEADER_VALUE;

  return value;
}

/**
 * Parses an RFC 3339 reset header into epoch milliseconds.
 *
 * @param headers - lowercase provider response headers
 *
 * @param headerName - lowercase reset header name to parse
 *
 * @returns epoch milliseconds, or invalid sentinel when missing or invalid
 *
 * @example
 * ```ts
 * parseResetHeader({ headers: { reset: '2026-06-01T12:00:00Z' }, headerName: 'reset' });
 * ```
 */
function parseResetHeader({
  headers,
  headerName,
}: Readonly<{
  headers: Readonly<Record<string, string>>;
  headerName: string;
}>,): number | InvalidHeaderValue {
  /**
   * Raw reset timestamp supplied by Anthropic.
   */
  const rawValue = headers[headerName];
  if (rawValue === undefined)
    return INVALID_HEADER_VALUE;

  /**
   * Parsed epoch timestamp in milliseconds.
   */
  const resetAtMs = Date.parse(rawValue,);
  if (!Number.isFinite(resetAtMs,))
    return INVALID_HEADER_VALUE;

  return resetAtMs;
}

/**
 * Clamps numeric value into inclusive range.
 *
 * @param value - number to clamp
 *
 * @param min - lower bound
 *
 * @param max - upper bound
 *
 * @returns value inside `[min, max]`
 *
 * @example
 * ```ts
 * clampNumber({ value: 12, min: 0, max: 10 });
 * ```
 */
function clampNumber({
  value,
  min,
  max,
}: Readonly<{
  value: number;
  min: number;
  max: number;
}>,): number {
  return Math.min(
    max,
    Math.max(
      min,
      value,
    ),
  );
}

/**
 * Detects valid parsed rate-limit snapshots.
 *
 * @param snapshot - optional snapshot from one header family parser
 *
 * @returns whether snapshot exists
 *
 * @example
 * ```ts
 * isRateLimitSnapshot(INVALID_RATE_LIMIT_SNAPSHOT);
 * ```
 */
function isRateLimitSnapshot(
  snapshot: RateLimitSnapshot | InvalidRateLimitSnapshot,
): snapshot is RateLimitSnapshot {
  return snapshot !== INVALID_RATE_LIMIT_SNAPSHOT;
}

//endregion Parsing helpers

//region Snapshot parsing

/**
 * Parses one header family into a rate-limit snapshot.
 *
 * @param family - Anthropic header family metadata
 *
 * @param headers - lowercase provider response headers
 *
 * @param nowMs - wall-clock sample time in epoch milliseconds
 *
 * @returns parsed snapshot, or invalid sentinel when any required header is unusable
 *
 * @example
 * ```ts
 * parseRateLimitSnapshot({ family, headers, nowMs: Date.now() });
 * ```
 */
function parseRateLimitSnapshot({
  family,
  headers,
  nowMs,
}: Readonly<{
  family: RateLimitHeaderFamily;
  headers: Readonly<Record<string, string>>;
  nowMs: number;
}>,): RateLimitSnapshot | InvalidRateLimitSnapshot {
  /**
   * Limiter capacity from `*-limit` header.
   */
  const limit = parseNumberHeader({
    headers,
    headerName: family.limitHeader,
  },);
  /**
   * Remaining capacity from `*-remaining` header.
   */
  const rawRemaining = parseNumberHeader({
    headers,
    headerName: family.remainingHeader,
  },);
  /**
   * Reset timestamp from `*-reset` header.
   */
  const resetAtMs = parseResetHeader({
    headers,
    headerName: family.resetHeader,
  },);

  if ((limit === INVALID_HEADER_VALUE)
    || (rawRemaining === INVALID_HEADER_VALUE)
    || (resetAtMs === INVALID_HEADER_VALUE))
    return INVALID_RATE_LIMIT_SNAPSHOT;
  if (limit <= 0)
    return INVALID_RATE_LIMIT_SNAPSHOT;

  /**
   * Remaining capacity clamped because some headers are rounded.
   */
  const remaining = clampNumber({
    value: rawRemaining,
    min: 0,
    max: limit,
  },);
  /**
   * Used capacity expressed as percentage of capacity.
   */
  const usedPercent = ((limit - remaining) / limit) * PERCENT_BASE;
  /**
   * Remaining capacity expressed as floored whole percentage.
   */
  const remainingPercent = Math.floor((remaining / limit) * PERCENT_BASE,);

  return {
    key: family.key,
    label: family.label,
    limit,
    remaining,
    resetAtMs,
    sampledAtMs: nowMs,
    usedPercent,
    remainingPercent,
  };
}

/**
 * Parses all supported Anthropic rate-limit header groups.
 *
 * @param headers - provider response headers from Pi
 *
 * @param nowMs - wall-clock sample time in epoch milliseconds
 *
 * @returns parsed snapshots for complete and valid header groups
 *
 * @example
 * ```ts
 * parseRateLimitSnapshots({ headers, nowMs: Date.now() });
 * ```
 */
function parseRateLimitSnapshots({
  headers,
  nowMs,
}: Readonly<{
  headers: Readonly<Record<string, string>>;
  nowMs: number;
}>,): readonly RateLimitSnapshot[] {
  /**
   * Headers keyed by lowercase name so providers may vary casing.
   */
  const normalizedHeaders = normalizeHeaders(headers,);

  return RATE_LIMIT_HEADER_FAMILIES
    .map(function parseFamily(family,): RateLimitSnapshot | InvalidRateLimitSnapshot {
      return parseRateLimitSnapshot({
        family,
        headers: normalizedHeaders,
        nowMs,
      },);
    },)
    .filter(function keepSnapshot(snapshot,): snapshot is RateLimitSnapshot {
      return isRateLimitSnapshot(snapshot,);
    },);
}

//endregion Snapshot parsing

export {
  RATE_LIMIT_HEADER_FAMILIES,
  normalizeHeaders,
  parseRateLimitSnapshots,
};
