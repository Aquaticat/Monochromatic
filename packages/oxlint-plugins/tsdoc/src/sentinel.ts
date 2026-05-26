/**
 * Absence sentinel shared by the TSDoc finder and parser helpers.
 *
 * The optionality discipline bans `T | undefined` / `T | null` return
 * types, so functions that may legitimately find nothing return
 * `T | typeof ABSENT` and callers narrow with `=== ABSENT`. Mirrors the
 * `@monochromatic-dev/module-kv-store` `ABSENT` contract.
 *
 * @module
 */

/**
 * Unique value meaning "nothing was found"; never a real domain value.
 *
 * @example
 * ```ts
 * const found = findTsdocComment({ node, context, });
 * if (found === ABSENT)
 *   return;
 * ```
 */
export const ABSENT: unique symbol = Symbol('absent',);
