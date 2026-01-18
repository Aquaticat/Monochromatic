/** Generic record type alias for objects with any key type. */
import type { $ as Record$, } from '../../../../t/index.ts';

import { $ as pickNamed, } from '../p n/index.ts';

/**
 * Creates a new object by picking only specified keys from the original object.
 * The inverse of omit - selects properties instead of removing them.
 * Positional parameter variant that delegates to the named parameter version.
 *
 * @param original - Source object to pick properties from
 * @param toPick - Set of keys to include in the result
 * @param strict - When true (default), throws if any key in toPick is not found in the original object.
 *   When false, silently ignores missing keys.
 * @returns New object with only the picked properties
 * @throws Error if strict is true and any key in toPick is not found in original
 * @example
 * ```ts
 * const user = { id: 1, name: 'Alice', password: 'secret' };
 * const public$ = $(user, new Set(['id', 'name']));
 * // { id: 1, name: 'Alice' }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObject extends Record$<string | number | symbol, unknown>,
  const TKeys extends keyof TObject,
>(
  original: TObject,
  toPick: ReadonlySet<TKeys>,
  strict = true,
): Pick<TObject, TKeys> {
  return pickNamed({ original, toPick, strict, },);
}
