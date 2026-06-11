/**
 * Generic record type alias for objects with any key type.
 */
import type { $ as Record$, } from '../../../../t/index.ts';

import {
  $ as omitFromIterable,
} from '../../../../../../t function/t generator/f/t iterable/omit/r s/p n/index.ts';

/**
 * Creates a new object by omitting specified keys from the original object.
 * The inverse of pick - removes properties instead of selecting them.
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
 * const safe = $({ original: user, toOmit: new Set(['password']) });
 * // { id: 1, name: 'Alice' }
 * ```
 *
 * @example Lenient mode ignores missing keys
 * ```ts
 * const user = { id: 1, name: 'Alice' };
 * const result = $({ original: user, toOmit: new Set(['missing']), strict: false });
 * // { id: 1, name: 'Alice' } - no error thrown
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObject extends Record$<string | number | symbol, unknown>,
  const TKeys extends keyof TObject,
>(
  {
    original,
    toOmit,
    strict = true,
  }: {
    original: TObject;
    toOmit: ReadonlySet<TKeys>;
    strict?: boolean;
  },
): Omit<TObject, TKeys> {
  /**
   * Accumulator for properties not in the omit list.
   */
  const result: Record<string | number | symbol, unknown> = {};

  // Normalize user's keys to match Reflect.ownKeys output format.
  // Reflect.ownKeys returns numeric keys as strings (e.g., '1' not 1), so convert numbers to strings.
  // Only store ONE representation per key to ensure the stricter omitFromIterable validation passes.
  /**
   * Normalised omit set with numeric keys widened to strings to match Reflect.ownKeys output.
   */
  const normalizedOmitSet = new Set<string | symbol>();
  for (const key of toOmit) {
    if ((typeof key) === 'number')
      normalizedOmitSet.add(String(key,),);
    else
      normalizedOmitSet.add(key,);
  }

  // Reflect.ownKeys returns all own property keys including symbols, unlike Object.keys which only returns enumerable string keys.
  // This ensures symbol-keyed properties are handled correctly when toOmit contains symbols.
  for (const key of omitFromIterable({
    iterable: Reflect.ownKeys(original,),
    toOmit: normalizedOmitSet,
    strict,
  },)) {
    result[key] = (original as Record<typeof key, unknown>)[key];
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- constructed result matches Omit<TObject, TKeys> shape
  return result as Omit<TObject, TKeys>;
}
