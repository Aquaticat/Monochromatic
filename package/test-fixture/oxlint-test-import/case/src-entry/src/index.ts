/**
 * Declared `main` entry that wrongly points into source.
 *
 * @module
 */

/**
 * Returns its argument unchanged.
 *
 * @param text - value echoed back
 *
 * @returns same value
 *
 * @example
 * ```ts
 * entry('a');
 * ```
 */
export function entry(text: string,): string {
  return text;
}
