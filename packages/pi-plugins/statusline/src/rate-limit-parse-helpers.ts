/**
 * Shared parser helpers for provider usage headers.
 *
 * @module
 */

import {
  MILLISECONDS_PER_SECOND,
  PERCENT_BASE,
  type RateLimitSnapshot,
} from './rate-limit-types.ts';

/**
 * Sentinel returned when a header or object property is missing or invalid.
 */
const INVALID_VALUE: unique symbol = Symbol('usage header value missing or invalid',);

/**
 * Sentinel returned when a provider value cannot produce a snapshot.
 */
const INVALID_RATE_LIMIT_SNAPSHOT: unique symbol = Symbol('usage rate limit snapshot missing or invalid',);

/**
 * Invalid value sentinel type.
 */
type InvalidValue = typeof INVALID_VALUE;

/**
 * Invalid snapshot sentinel type.
 */
type InvalidRateLimitSnapshot = typeof INVALID_RATE_LIMIT_SNAPSHOT;

/**
 * Unknown object record used while parsing provider JSON.
 */
type UnknownRecord = Readonly<Record<string, unknown>>;

/**
 * Normalizes provider headers to lowercase names.
 *
 * @param headers - provider response headers from Pi
 *
 * @returns header record keyed by lowercase header names
 *
 * @example
 * ```ts
 * normalizeHeaders({ 'X-Codex-Primary-Used-Percent': '50' });
 * ```
 */
function normalizeHeaders(
  headers: Record<string, string>,
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
 * @returns numeric value, or {@link INVALID_VALUE} when missing or invalid
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
}>,): number | InvalidValue {
  /**
   * Raw header value, if the provider supplied it.
   */
  const rawValue = headers[headerName];
  if (rawValue === undefined)
    return INVALID_VALUE;

  /**

   * Numeric header value parsed from the raw string.

   */
  const value = Number(rawValue,);
  if ((!Number.isFinite(value,)) || (value < 0))
    return INVALID_VALUE;

  return value;
}

/**
 * Parses a string header and trims whitespace.
 *
 * @param headers - lowercase provider response headers
 *
 * @param headerName - lowercase header name to parse
 *
 * @returns trimmed string value, or {@link INVALID_VALUE} when missing or empty
 *
 * @example
 * ```ts
 * parseStringHeader({ headers: { name: ' codex ' }, headerName: 'name' });
 * ```
 */
function parseStringHeader({
  headers,
  headerName,
}: Readonly<{
  headers: Readonly<Record<string, string>>;
  headerName: string;
}>,): string | InvalidValue {
  /**
   * Raw header value, if the provider supplied it.
   */
  const rawValue = headers[headerName];
  if (rawValue === undefined)
    return INVALID_VALUE;

  /**

   * Trimmed header value.

   */
  const value = rawValue.trim();
  if (value.length === 0)
    return INVALID_VALUE;

  return value;
}

/**
 * Parses an RFC 3339 reset header into epoch milliseconds.
 *
 * @param headers - lowercase provider response headers
 *
 * @param headerName - lowercase reset header name to parse
 *
 * @returns epoch milliseconds, or {@link INVALID_VALUE} when missing or invalid
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
}>,): number | InvalidValue {
  /**
   * Raw reset timestamp supplied by the provider.
   */
  const rawValue = headers[headerName];
  if (rawValue === undefined)
    return INVALID_VALUE;

  /**

   * Parsed epoch timestamp in milliseconds.

   */
  const resetAtMs = Date.parse(rawValue,);
  if (!Number.isFinite(resetAtMs,))
    return INVALID_VALUE;

  return resetAtMs;
}

/**
 * Parses an epoch-seconds reset header into epoch milliseconds.
 *
 * @param headers - lowercase provider response headers
 *
 * @param headerName - lowercase reset header name to parse
 *
 * @returns epoch milliseconds, or {@link INVALID_VALUE} when missing or invalid
 *
 * @example
 * ```ts
 * parseEpochSecondsHeader({ headers: { reset: '1704069000' }, headerName: 'reset' });
 * ```
 */
function parseEpochSecondsHeader({
  headers,
  headerName,
}: Readonly<{
  headers: Readonly<Record<string, string>>;
  headerName: string;
}>,): number | InvalidValue {
  /**
   * Parsed reset value in seconds.
   */
  const seconds = parseNumberHeader({
    headers,
    headerName,
  },);
  if (seconds === INVALID_VALUE)
    return INVALID_VALUE;

  return seconds * MILLISECONDS_PER_SECOND;
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
 * Detects object records while parsing JSON.
 *
 * @param value - unknown value to inspect
 *
 * @returns whether value is a non-array object
 *
 * @example
 * ```ts
 * isUnknownRecord({});
 * ```
 */
function isUnknownRecord(value: unknown,): value is UnknownRecord {
  return ((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,));
}

/**
 * Reads nested object property from an unknown record.
 *
 * @param record - source record
 *
 * @param key - property key to read
 *
 * @returns nested object, or {@link INVALID_VALUE} when missing or not an object
 *
 * @example
 * ```ts
 * readRecordProperty({ record: { nested: {} }, key: 'nested' });
 * ```
 */
function readRecordProperty({
  record,
  key,
}: Readonly<{
  record: UnknownRecord;
  key: string;
}>,): UnknownRecord | InvalidValue {
  /**
   * Property value before type narrowing.
   */
  const value = record[key];
  if (!isUnknownRecord(value,))
    return INVALID_VALUE;

  return value;
}

/**
 * Reads numeric property from an unknown record.
 *
 * @param record - source record
 *
 * @param key - property key to read
 *
 * @returns finite number, or {@link INVALID_VALUE} when missing or invalid
 *
 * @example
 * ```ts
 * readNumberProperty({ record: { used: 42 }, key: 'used' });
 * ```
 */
function readNumberProperty({
  record,
  key,
}: Readonly<{
  record: UnknownRecord;
  key: string;
}>,): number | InvalidValue {
  /**
   * Property value before numeric narrowing.
   */
  const value = record[key];
  if (((typeof value) !== 'number') || (!Number.isFinite(value,)))
    return INVALID_VALUE;

  return value;
}

/**
 * Reads string property from an unknown record.
 *
 * @param record - source record
 *
 * @param key - property key to read
 *
 * @returns non-empty string, or {@link INVALID_VALUE} when missing or invalid
 *
 * @example
 * ```ts
 * readStringProperty({ record: { reset: '2026-06-01T12:00:00Z' }, key: 'reset' });
 * ```
 */
function readStringProperty({
  record,
  key,
}: Readonly<{
  record: UnknownRecord;
  key: string;
}>,): string | InvalidValue {
  /**
   * Property value before string narrowing.
   */
  const value = record[key];
  if ((typeof value) !== 'string')
    return INVALID_VALUE;

  /**

   * Trimmed property value.

   */
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0)
    return INVALID_VALUE;

  return trimmedValue;
}

/**
 * Parses reset property from an unknown record.
 *
 * @param record - source record
 *
 * @param key - property key to read
 *
 * @returns epoch milliseconds, or {@link INVALID_VALUE} when missing or invalid
 *
 * @example
 * ```ts
 * readResetProperty({ record: { reset: '2026-06-01T12:00:00Z' }, key: 'reset' });
 * ```
 */
function readResetProperty({
  record,
  key,
}: Readonly<{
  record: UnknownRecord;
  key: string;
}>,): number | InvalidValue {
  /**
   * Reset string before timestamp parsing.
   */
  const value = readStringProperty({
    record,
    key,
  },);
  if (value === INVALID_VALUE)
    return INVALID_VALUE;

  /**

   * Parsed reset timestamp in milliseconds.

   */
  const resetAtMs = Date.parse(value,);
  if (!Number.isFinite(resetAtMs,))
    return INVALID_VALUE;

  return resetAtMs;
}

/**
 * Computes bounded percentage from used and limit values.
 *
 * @param used - used quota value
 *
 * @param limit - total quota value
 *
 * @returns used percentage clamped to non-negative values
 *
 * @example
 * ```ts
 * usedPercentFromLimit({ used: 5, limit: 10 });
 * ```
 */
function usedPercentFromLimit({
  used,
  limit,
}: Readonly<{
  used: number;
  limit: number;
}>,): number | InvalidValue {
  if (limit <= 0)
    return INVALID_VALUE;
  if (used < 0)
    return INVALID_VALUE;

  return Math.max(
    0,
    (used / limit) * PERCENT_BASE,
  );
}

/**
 * Creates a generic {@link RateLimitSnapshot} from provider-specific values.
 *
 * @param key - stable snapshot key
 *
 * @param label - footer label
 *
 * @param resetAtMs - reset timestamp in epoch milliseconds
 *
 * @param windowSeconds - fixed window duration in seconds
 *
 * @param paceScale - optional elapsed-pace multiplier
 *
 * @param sampledAtMs - sample timestamp in epoch milliseconds
 *
 * @param usedPercent - used capacity percentage
 *
 * @returns generic {@link RateLimitSnapshot}, or {@link INVALID_RATE_LIMIT_SNAPSHOT} when a field is invalid
 *
 * @example
 * ```ts
 * createRateLimitSnapshot({ key: 'demo', label: 'demo', resetAtMs, windowSeconds: 60, paceScale: 1, sampledAtMs, usedPercent: 50 });
 * ```
 */
function createRateLimitSnapshot({
  key,
  label,
  resetAtMs,
  windowSeconds,
  paceScale,
  sampledAtMs,
  usedPercent,
}: Readonly<{
  key: string;
  label: string;
  resetAtMs: number;
  windowSeconds: number;
  paceScale: number;
  sampledAtMs: number;
  usedPercent: number;
}>,): RateLimitSnapshot | InvalidRateLimitSnapshot {
  if ((!Number.isFinite(resetAtMs,))
    || (!Number.isFinite(windowSeconds,))
    || (windowSeconds <= 0))
    return INVALID_RATE_LIMIT_SNAPSHOT;
  if ((!Number.isFinite(paceScale,)) || (paceScale <= 0))
    return INVALID_RATE_LIMIT_SNAPSHOT;
  if ((!Number.isFinite(usedPercent,)) || (usedPercent < 0))
    return INVALID_RATE_LIMIT_SNAPSHOT;

  return {
    key,
    label,
    resetAtMs,
    windowSeconds,
    paceScale,
    sampledAtMs,
    usedPercent,
  };
}

/**
 * Detects valid parsed rate-limit snapshots.
 *
 * @param snapshot - optional snapshot from one parser
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

export {
  INVALID_RATE_LIMIT_SNAPSHOT,
  INVALID_VALUE,
  clampNumber,
  createRateLimitSnapshot,
  isRateLimitSnapshot,
  isUnknownRecord,
  normalizeHeaders,
  parseEpochSecondsHeader,
  parseNumberHeader,
  parseResetHeader,
  parseStringHeader,
  readNumberProperty,
  readRecordProperty,
  readResetProperty,
  usedPercentFromLimit,
};
export type {
  InvalidRateLimitSnapshot,
  InvalidValue,
  UnknownRecord,
};
