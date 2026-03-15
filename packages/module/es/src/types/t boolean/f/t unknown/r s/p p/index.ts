/**
 * Converts a value to its boolean equivalent.
 *
 * @param value - value to coerce
 *
 * @returns truthy/falsy boolean coercion of value
 */
export function $(value: unknown,): boolean {
  // oxlint-disable-next-line unicorn/prefer-native-coercion-functions -- wrapper function preserves named export convention
  return Boolean(value,);
}
