/**
 * Content-based and text-based signal detection.
 *
 * Owns the regex panel that flags secrets in payload bodies
 * (`contentSignals`) and dangerous keywords in free text
 * (`textSignals`).
 *
 * @module
 */

import {
  BUILTIN_TEXT_PATTERNS,
  PRIVATE_KEY_PATTERN,
  SECRET_FORMAT_PATTERNS,
} from './constants.ts';
/**
 * Check if text content contains secret material.
 *
 * Detects {@link PRIVATE_KEY_PATTERN} headers and known
 * {@link SECRET_FORMAT_PATTERNS} token/key formats.
 *
 * @param text - the text content to check
 *
 * @returns `true` if secret material is detected
 *
 * @example
 * ```typescript
 * contentSignals("-----BEGIN RSA PRIVATE KEY-----"); // true
 * contentSignals("Hello, world!"); // false
 * ```
 */
function contentSignals(
  text: string,
): boolean {
  if (PRIVATE_KEY_PATTERN.test(text,))
    return true;

  for (const pattern of SECRET_FORMAT_PATTERNS) {
    if (pattern.test(text,))
      return true;
  }

  return false;
}

/**
 * Check raw text against {@link BUILTIN_TEXT_PATTERNS}.
 *
 * @returns `true` if any pattern matches
 *
 * @example
 * ```typescript
 * textSignals({ text: "run sudo apt-get install" }); // true
 * textSignals({ text: "run apt-get install" }); // false
 * ```
 */
function textSignals(
  {
    text,
  }: {
    readonly text: string;
  },
): boolean {
  for (const pattern of BUILTIN_TEXT_PATTERNS) {
    if (pattern.test(text,))
      return true;
  }

  return false;
}

export {
  contentSignals,
  textSignals,
};
