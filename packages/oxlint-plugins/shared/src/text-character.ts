/**
 * Shared ASCII character predicates for plugin scanners.
 *
 * @module
 */

/**
 * Checks whether character is ASCII whitespace used by plugin scanners.
 *
 * @param char - Candidate character.
 *
 * @returns whether character is recognized whitespace.
 *
 * @example
 * ```ts
 * isWhitespaceChar(' '); // true
 * ```
 */
export function isWhitespaceChar(char: string,): boolean {
  return (char === ' ')
    || (char === '\t')
    || (char === '\n')
    || (char === '\r')
    || (char === '\f')
    || (char === '\v');
}

/**
 * Checks whether character is an ASCII word character.
 *
 * @param char - Candidate character.
 *
 * @returns whether character qualifies as `[A-Za-z0-9_]`.
 *
 * @example
 * ```ts
 * isWordChar('a'); // true
 * ```
 */
export function isWordChar(char: string,): boolean {
  return ((char >= '0') && (char <= '9'))
    || ((char >= 'a') && (char <= 'z'))
    || ((char >= 'A') && (char <= 'Z'))
    || (char === '_');
}
