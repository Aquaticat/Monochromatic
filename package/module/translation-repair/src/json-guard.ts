//region JSON record guard
// Shared narrowing for probing parsed JSON of unknown shape; both provider
// protocol parsing (quotas, completions) and model-content validation build on it.

/**
 * Narrows unknown JSON to a plain record for field probing.
 * Arrays pass too, which is harmless: numeric-keyed probes simply miss.
 *
 * @param value - candidate from parsed JSON
 *
 * @returns Whether value can be probed for properties
 *
 * @example
 * ```ts
 * if (isJsonRecord(parsed,)) probe(parsed['choices'],);
 * ```
 */
export function isJsonRecord(value: unknown,): value is Record<string, unknown> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 * Narrows unknown JSON to an element-unknown array,
 * avoiding the `any[]` that bare `Array.isArray` narrowing introduces.
 *
 * @param value - candidate from parsed JSON
 *
 * @returns Whether value is an array of unknowns
 *
 * @example
 * ```ts
 * if (isJsonArray(parsed,)) probe(parsed[0],);
 * ```
 */
export function isJsonArray(value: unknown,): value is readonly unknown[] {
  return Array.isArray(value,);
}

//endregion JSON record guard
