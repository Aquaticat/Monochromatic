/**
 * Invalid readonly fixtures proving traversal-hook narrowing stays closed
 * for hook-capable inputs and true mutation.
 *
 * @module
 */

/**
 * Enumerates non-plain readonly collection keeping the hook-class effect.
 *
 * @param entriesSource - Readonly collection whose enumeration may run hooks.
 *
 * @returns own-property entry count.
 */
export function enumerateReadonlyMapEntries(
  entriesSource: ReadonlyMap<string, string>,
): number {
  return Object.entries(entriesSource,).length;
}

/**
 * Freezes plain data keeping the descriptor mutation effect.
 *
 * @param value - Plain caller object whose descriptors change.
 *
 * @returns same object frozen.
 */
export function freezePlainValue(
  value: { readonly label: string; },
): Readonly<{ readonly label: string; }> {
  return Object.freeze(value,);
}

/**
 * Coerces unknown data through exact global String keeping coercion hooks.
 *
 * @param value - Unknown value whose conversion may dispatch hooks.
 *
 * @returns coerced text.
 */
export function coerceUnknownValue(value: unknown,): string {
  return String(value,);
}
