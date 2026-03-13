/** Generic record type alias for objects with any key type. */
import type { $ as Record$, } from '../../../../t/index.ts';

import { $ as omitNamed, } from '../p n/index.ts';

/**
 * Creates a new object by omitting specified keys from the original object.
 * The inverse of pick - removes properties instead of selecting them.
 * Positional parameter variant that delegates to the named parameter version.
 *
 * @param original - Source object to omit properties from
 *
 * @param toOmit - Set of keys to exclude from the result
 *
 * @param strict - When true (default), throws if any key in toOmit is not found in the original object.
 *   When false, silently ignores missing keys.
 *
 * @returns New object without the omitted properties
 *
 * @throws Error if strict is true and any key in toOmit is not found in original
 *
 * @example
 * ```ts
 * const user = { id: 1, name: 'Alice', password: 'secret' };
 * const safe = $(user, new Set(['password']));
 * // { id: 1, name: 'Alice' }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObject extends Record$<string | number | symbol, unknown>,
  const TKeys extends keyof TObject,
>(
  original: TObject,
  toOmit: ReadonlySet<TKeys>,
  strict = true,
): Omit<TObject, TKeys> {
  return omitNamed({ original, toOmit, strict, },);
}
