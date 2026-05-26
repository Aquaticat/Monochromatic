/**
 * Shared "value or absent" sentinel for the catalog-tighten pipeline.
 *
 * The workspace bans `T | null` and `T | undefined` union types
 * (`no-restricted-syntax/no-nullish-union`). Object fields express
 * absence with an optional `?:` property, but function return values
 * cannot use `?:`, so they signal "no value" with the {@link ABSENT}
 * symbol instead. A unique symbol is a genuine sentinel: it can never
 * collide with a real version string or parsed range and never widens a
 * slot to a nullish union.
 *
 * @example
 * ```ts
 * function lookup(name: string): Maybe<string> {
 *   const hit = table[name];
 *   return hit === undefined ? ABSENT : hit;
 * }
 * const value = lookup('oxlint');
 * if (value === ABSENT) {
 *   // handle the absent case
 * }
 * ```
 */

/**
 * Sentinel returned in place of a value that is genuinely absent.
 *
 * Annotated `unique symbol` so {@link Maybe} can reference its type via
 * `typeof ABSENT` and so identity stays stable across module boundaries.
 */
export const ABSENT: unique symbol = Symbol('catalog-tighten:absent',);

/**
 * Function-return type for a value that may be absent.
 *
 * @typeParam T - present-value type
 */
export type Maybe<T,> = T | typeof ABSENT;
