/* oxlint-disable unicorn/prefer-native-coercion-functions -- wrapper function preserves named export convention */
/**
 * Converts a value to its boolean equivalent.
 *
 * @param value - value to coerce
 *
 * @returns truthy/falsy boolean coercion of value
 *
 * @example
 * ```ts
 * $(1); // true
 * $(0); // false
 * $(''); // false
 * ```
 */
export function $(value: unknown,): boolean {
  return Boolean(value,);
}
/* oxlint-enable unicorn/prefer-native-coercion-functions */
