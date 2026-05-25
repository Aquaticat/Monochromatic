/**
 * Helper for building records with optional fields under
 * `exactOptionalPropertyTypes` without widening any slot to `T | undefined`.
 */

/**
 * Drops keys whose value is `undefined`, yielding a record whose every key is
 * exact-optional (present with a defined value, or absent entirely).
 *
 * Under `exactOptionalPropertyTypes`, assigning a possibly-`undefined` value to
 * an optional slot is rejected; spreading the result of this helper instead
 * keeps `undefined` out of the typed slot while still omitting missing fields.
 *
 * @param object - record whose `undefined`-valued keys are removed
 *
 * @returns same record with `undefined`-valued keys removed and each remaining
 * key narrowed to its non-`undefined` form
 *
 * @example
 * ```ts
 * const point = { runId, score, ...omitUndefined({ pass2Score, icon, }), };
 * // pass2Score / icon appear only when defined
 * ```
 */
export function omitUndefined<const T extends Readonly<Record<string, unknown>>>(
  object: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  /** Entries whose value is defined; the absent ones are dropped from the result. */
  const definedEntries = Object.entries(object,)
    .filter(function hasValue(entry,): boolean {
      return entry[1]
        !== undefined;
    },);
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Object.fromEntries widens to a string-index record; the mapped return type re-narrows each key to its non-undefined form, which the runtime filter above guarantees
  return Object.fromEntries(definedEntries,) as { [K in keyof T]?: Exclude<T[K], undefined> };
}
