/**
 * Shared "value or absent" sentinel for terminal resolution.
 *
 * The workspace bans `T | null` and `T | undefined` union types
 * (`no-restricted-syntax/no-nullish-union`). Object fields express
 * absence with an optional `?:` property, but function return values
 * cannot use `?:`, so they signal "no value" with the {@link ABSENT}
 * symbol instead. A unique symbol is a genuine sentinel: it can never
 * collide with a real domain value and never widens a slot to a nullish
 * union.
 *
 * Symbols do not survive `JSON.stringify`, so {@link ABSENT} is for
 * in-memory function returns only.
 *
 * @example
 * ```ts
 * function lookup(key: string): Maybe<number> {
 *   const hit = table[key];
 *   return hit === undefined ? ABSENT : hit;
 * }
 * const value = lookup('x');
 * if (value === ABSENT) {
 *   // handle the absent case
 * }
 * ```
 *
 * @module
 */

/**
 * Sentinel returned in place of a value that is genuinely absent.
 *
 * Annotated `unique symbol` so {@link Maybe} can reference its type via
 * `typeof ABSENT` and so identity stays stable across module boundaries.
 */
export const ABSENT: unique symbol = Symbol('absent',);

/**
 * Function-return type for a value that may be absent.
 *
 * @typeParam T - Present-value type.
 */
export type Maybe<T,> = T | typeof ABSENT;
