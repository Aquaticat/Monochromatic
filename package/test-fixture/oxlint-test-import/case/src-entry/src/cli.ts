/**
 * Declared `bin` entry that wrongly points into source.
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
 * run('a');
 * ```
 */
export function run(text: string,): string {
  return text;
}
