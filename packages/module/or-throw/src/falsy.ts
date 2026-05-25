/**
 * Shared `Falsy` type alias used by `truthyOrThrow` and `falsyOrThrow`
 * to express the values that coerce to `false` in a boolean context.
 *
 * @module
 */

/* oxlint-disable no-restricted-syntax/no-undefined-union -- `undefined` is intrinsically a falsy value; this type enumerates the falsy set and is incomplete without it */
/**
 * Union of the values that JavaScript evaluates as `false` in a boolean context.
 *
 * `NaN` is falsy at runtime but cannot be represented as a TypeScript literal type,
 * so it is not in this union. Helpers in this package check for falsiness at runtime
 * (via `!value` or its negation), which catches `NaN`; the static type just cannot
 * exclude `NaN` from a `number`.
 *
 * @example
 * ```ts
 * import type { Falsy, } from '\@monochromatic-dev/module-or-throw';
 *
 * function isFalsy(value: unknown,): value is Falsy {
 *   return !value;
 * }
 * ```
 */
export type Falsy = false | 0 | 0n | '' | null | undefined;
/* oxlint-enable no-restricted-syntax/no-undefined-union */
