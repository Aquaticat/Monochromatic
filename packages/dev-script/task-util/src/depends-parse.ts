/**
 * Parsing utilities for task-depends item resolution.
 *
 * Provides timestamp parsing and item classification helpers
 * used by the resolution pipeline.
 *
 * @module
 */

//region Constants

/** Prefix that identifies a shell command item */
export const SH_PREFIX = 'sh:';

/**
 * Boundary for distinguishing unix seconds from milliseconds.
 *
 * Numbers \>= 1e12 are treated as milliseconds (dates after 2001 in ms).
 * Numbers \< 1e12 are treated as seconds and multiplied by 1000.
 */
const SECONDS_MS_BOUNDARY = 1e12;

/** Multiplier for converting seconds to milliseconds */
const MS_PER_SECOND = 1_000;

//endregion Constants

//region Item classification

/**
 * Checks whether an item is a shell command (prefixed with `sh:`).
 *
 * @param item - Source or output item string
 *
 * @returns `true` when the item starts with `sh:`
 *
 * @example
 * ```ts
 * isShellCommand('sh:podman image exists foo') // true
 * isShellCommand('src/*.ts') // false
 * ```
 */
export function isShellCommand(item: string,): boolean {
  return item.startsWith(SH_PREFIX,);
}

/**
 * Strips the `sh:` prefix from a shell command item.
 *
 * @param item - Shell command item with `sh:` prefix
 *
 * @returns Command string without prefix
 *
 * @example
 * ```ts
 * extractCommand('sh:podman image exists foo') // 'podman image exists foo'
 * ```
 */
export function extractCommand(item: string,): string {
  return item.slice(SH_PREFIX.length,);
}

//endregion Item classification

//region Timestamp parsing

/**
 * Parses a string as a timestamp.
 *
 * Supports unix epoch (seconds or milliseconds), ISO 8601 dates,
 * and the sentinel strings `Infinity` and `-Infinity`.
 * Numbers \>= 1e12 are treated as milliseconds; smaller numbers as seconds.
 *
 * @param value - Trimmed stdout from a shell command
 *
 * @returns Timestamp in milliseconds (possibly `Infinity` or `-Infinity`),
 * or `undefined` when not parseable
 *
 * @example
 * ```ts
 * parseTimestamp('1710000000') // 1710000000000 (seconds -> ms)
 * parseTimestamp('Infinity') // Infinity
 * parseTimestamp('-Infinity') // -Infinity
 * parseTimestamp('') // undefined
 * ```
 */
export function parseTimestamp(value: string,): number | undefined {
  if (value === '')
    return undefined;
  if (value === 'Infinity')
    return Infinity;
  if (value === '-Infinity')
    return -Infinity;

  const num = Number(value,);
  if (!Number.isNaN(num,) && Number.isFinite(num,))
    return num >= SECONDS_MS_BOUNDARY ? num : num * MS_PER_SECOND;

  const date = new Date(value,);
  if (!Number.isNaN(date.getTime(),))
    return date.getTime();

  return undefined;
}

//endregion Timestamp parsing
