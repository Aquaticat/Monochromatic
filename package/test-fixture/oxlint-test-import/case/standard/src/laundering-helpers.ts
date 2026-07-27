/**
 * Allowlisted helper that reaches straight into source.
 *
 * The name matches the `**\/*-helpers.ts` allowlist glob, so a test may import
 * this module freely. That is exactly why the rule checks helper modules too:
 * were this file unchecked, it could launder source access on behalf of any
 * test importing it, with no change to the test's own import.
 *
 * Expected diagnostics: one, for the source import below.
 *
 * @module
 */

import { parse, } from './parse.ts';

/**
 * Forwards package behavior reached through source.
 *
 * @param text - value echoed back
 *
 * @returns same value
 *
 * @example
 * ```ts
 * launder('a');
 * ```
 */
export function launder(text: string,): string {
  return parse(text,);
}
