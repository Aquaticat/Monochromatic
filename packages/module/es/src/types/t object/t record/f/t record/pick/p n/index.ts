/**
 * Generic record type alias for objects with any key type.
 */
import type { $ as Record$, } from '../../../../t/index.ts';

import {
  $ as pickFromIterable,
} from '../../../../../../t function/t generator/f/t iterable/pick/r s/p n/index.ts';

/**
 * Creates a new object by picking only specified keys from the original object.
 * The inverse of omit - selects properties instead of removing them.
 *
 * @param original - Source object to pick properties from
 *
 * @param toPick - Set of keys to include in the result
 *
 * @param strict - When true (default), throws if any key in toPick is not found in the original object.
 *   When false, silently ignores missing keys.
 *
 * @returns New object with only the picked properties
 *
 * @throws Error if strict is true and any key in toPick is not found in original
 *
 * @example
 * ```ts
 * const user = { id: 1, name: 'Alice', password: 'secret' };
 * const public$ = $({ original: user, toPick: new Set(['id', 'name']) });
 * // { id: 1, name: 'Alice' }
 * ```
 *
 * @example Lenient mode ignores missing keys
 * ```ts
 * const user = { id: 1, name: 'Alice' };
 * const result = $({ original: user, toPick: new Set(['id', 'missing']), strict: false });
 * // { id: 1 } - no error thrown
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObject extends Record$<string | number | symbol, unknown>,
  const TKeys extends keyof TObject,
>(
  {
    original,
    toPick,
    strict = true,
  }: {
    original: TObject;
    toPick: ReadonlySet<TKeys>;
    strict?: boolean;
  },
): Pick<TObject, TKeys> {
  /**
   * Accumulator for properties in the pick list.
   */
  const result: Record<string | number | symbol, unknown> = {};

  // WARNING: Iterate toPick, not original's keys. When picking few properties from a large object,
  // iterating the pick set is O(M) vs O(N) for iterating all keys. This matters when M << N.
  // Build a normalized set of original keys that includes both string and numeric representations.
  // Reflect.ownKeys returns numeric keys as strings (e.g., '1' not 1), but users may pass numbers in toPick.
  /**
   * Original keys widened with numeric duals so user-supplied numeric keys still match.
   */
  const normalizedOriginalKeys = new Set<string | number | symbol>();
  for (const key of Reflect.ownKeys(original,)) {
    normalizedOriginalKeys.add(key,);
    // Add numeric representation for string keys that are valid numbers so they match user-provided numeric keys.
    if ((typeof key) === 'string') {
      /**
       * Numeric dual added so user-supplied numeric keys match the string ownKey.
       */
      const numericKey = Number(key,);
      if (!Number.isNaN(numericKey,))
        normalizedOriginalKeys.add(numericKey,);
    }
  }

  // Iterate toPick and validate all keys exist in original, using pickFromIterable for strict validation.
  // Pass toPick as iterable and normalizedOriginalKeys as filter - pickFromIterable will throw if any
  // key from normalizedOriginalKeys is missing from toPick. We need the reverse: throw if toPick has
  // keys missing from normalizedOriginalKeys. So we swap: iterate normalizedOriginalKeys, filter by toPick.
  // However, this defeats the O(M) optimization. Instead, manually validate and iterate.
  for (const key of pickFromIterable({
    iterable: normalizedOriginalKeys,
    toPick,
    strict,
  },)) {
    result[key] = (original as Record<typeof key, unknown>)[key];
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- constructed result matches Pick<TObject, TKeys> shape
  return result as Pick<TObject, TKeys>;
}
