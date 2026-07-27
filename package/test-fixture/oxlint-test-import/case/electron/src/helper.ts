/**
 * Package behavior reached only through source, so importing it is rejected.
 *
 * The filename deliberately avoids the `*-helpers.ts` allowlist glob: this is
 * real package behavior, not a test-only helper.
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
