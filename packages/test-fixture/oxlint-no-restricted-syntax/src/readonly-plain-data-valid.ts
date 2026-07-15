/**
 * Valid readonly fixtures exercising traversal-hook narrowing:
 * hook-class effects skip statically plain data.
 *
 * @module
 */

/**
 * Recursive TOML-like plain value union.
 */
type PlainConfigValue =
  | string
  | number
  | boolean
  | readonly PlainConfigValue[]
  | { readonly [key: string]: PlainConfigValue; };

/**
 * Enumerates plain record entries without a hook-class effect.
 *
 * @param record - Plain readonly record crossing Object.entries.
 *
 * @returns entry count.
 */
export function enumeratePlainRecord(
  record: { readonly [key: string]: number; },
): number {
  return Object.entries(record,).length;
}

/**
 * Coerces plain structured data through exact global String without hooks.
 *
 * @param value - Plain readonly config value crossing String conversion.
 *
 * @returns coerced text.
 */
export function coercePlainValue(value: PlainConfigValue,): string {
  return String(value,);
}

/**
 * Joins plain-element list without element coercion hooks.
 *
 * @param counts - Plain readonly numeric list.
 *
 * @returns joined text.
 */
export function joinPlainElements(counts: readonly number[],): string {
  return counts.join(',',);
}

/**
 * Sorts plain-element copy without default-comparator coercion hooks.
 *
 * @param labels - Plain readonly label list.
 *
 * @returns sorted copy.
 */
export function sortPlainElements(labels: readonly string[],): readonly string[] {
  return labels.toSorted();
}
