// Shared guard for narrowing untrusted parsed JSON to a keyed object.

/**
 * Reports whether a value is a plain object rather than `null`, an array, or a primitive.
 * `typeof null` is `'object'` and arrays are objects, so both need excluding before a value
 * from `JSON.parse` may be read by key.
 *
 * @param value - Untrusted value from parsed JSON.
 *
 * @returns `true` when the value can carry string-keyed members.
 *
 * @example
 * ```ts
 * isPlainObject({ a: 1 });
 * // true
 * ```
 */
export function isPlainObject(value: unknown,): value is Record<string, unknown> {
  return ((typeof value) === 'object') && (value !== null)
    && (!Array.isArray(value,));
}
