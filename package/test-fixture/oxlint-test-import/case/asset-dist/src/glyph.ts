/**
 * Package behavior reached only through source, so importing it is rejected.
 *
 * @module
 */

/**
 * Returns its argument unchanged.
 *
 * @param name - value echoed back
 *
 * @returns same value
 *
 * @example
 * ```ts
 * glyph('a');
 * ```
 */
export function glyph(name: string,): string {
  return name;
}
