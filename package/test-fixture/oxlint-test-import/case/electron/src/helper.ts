/**
 * Package behavior reached only through source, so importing it is rejected.
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
 * helper('a');
 * ```
 */
export function helper(text: string,): string {
  return text;
}
