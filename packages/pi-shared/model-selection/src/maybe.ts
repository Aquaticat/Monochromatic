/**
 * Shared value-or-absent sentinel for model-selection helpers.
 *
 * The workspace bans nullish union return types. Optional object fields express
 * absence on persisted shapes, while function returns use {@link ABSENT} when
 * absence is expected and non-exceptional.
 *
 * Symbols do not survive JSON serialization, so {@link ABSENT} is only for
 * in-memory function returns.
 *
 * @module
 *
 * @example
 * ```typescript
 * function lookup(key: string): Maybe<number> {
 *   const hit = table.get(key);
 *   return hit === undefined ? ABSENT : hit;
 * }
 * ```
 */

/** Sentinel returned in place of an expected missing value. */
export const ABSENT: unique symbol = Symbol('absent',);

/**
 * Function-return type for a value that may be absent.
 *
 * @typeParam TValue - present-value type
 */
export type Maybe<TValue,> = TValue | typeof ABSENT;
