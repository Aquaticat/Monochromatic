/**
 * `functionOrThrow`: assert `typeof === 'function'`, return the narrowed value or throw.
 *
 * @module
 */

import type { ExtractOrUnknown, } from './extract-or-unknown.ts';

/**
 * Asserts that a value is callable, returning it with non-callable variants
 * removed from the type.
 *
 * Uses `typeof === 'function'`. This matches every callable in JavaScript:
 * function declarations, function expressions, arrow functions, async
 * functions, generator functions, classes (which are technically callable
 * as constructors), and built-in functions like `Array.from`.
 *
 * The target type `(...args: never[]) => unknown` uses contravariant `never[]`
 * to match any callable regardless of parameter types, the standard
 * "any-function" trick that avoids the banned `Function` type.
 *
 * The return type uses `ExtractOrUnknown` so `unknown` inputs narrow to the
 * function type instead of collapsing to `never`.
 *
 * @param value - Value to assert as callable
 *
 * @returns Same value with non-callable variants excluded from the type
 *
 * @throws Error when value is not callable
 *
 * @example
 * ```ts
 * const handler: unknown = config.onError;
 * const fn = functionOrThrow(handler,);
 * // fn is a callable; safe to invoke
 * fn('boom',);
 * ```
 */
export function functionOrThrow<T,>(value: T,): ExtractOrUnknown<T, (...args: never[]) => unknown> {
  if ((typeof value) !== 'function')
    throw new Error(`Expected function, got ${typeof value} ${String(value,)}`,);
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- TypeScript cannot statically narrow generic T after typeof
  return value as ExtractOrUnknown<T, (...args: never[]) => unknown>;
}
