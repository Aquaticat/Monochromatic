/**
 * Shared "value or absent" sentinel for SVG attribute extraction.
 *
 * The workspace bans `T | null` and `T | undefined` union types
 * (`no-restricted-syntax/no-nullish-union`). Object fields express
 * absence with an optional `?:` property, but function return values
 * cannot use `?:`, so they signal "no value" with the {@link ABSENT}
 * symbol instead. A unique symbol is a genuine sentinel: it can never
 * collide with a real attribute value (an empty string is a valid
 * attribute value, not "absent") and never widens a slot to a nullish
 * union.
 *
 * Symbols do not survive `JSON.stringify`, so {@link ABSENT} is for
 * in-memory function returns only.
 *
 * @example
 * ```ts
 * function attr(name: string): Maybe<string> {
 *   const start = haystack.indexOf(name);
 *   return start === -1 ? ABSENT : haystack.slice(start);
 * }
 * const value = attr('fill');
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
export const ABSENT: unique symbol = Symbol('aquaticat:absent',);

/**
 * Function-return type for a value that may be absent.
 *
 * @typeParam T - Present-value type.
 */
export type Maybe<T,> = T | typeof ABSENT;
