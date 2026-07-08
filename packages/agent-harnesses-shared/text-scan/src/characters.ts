/**
 * Regex-free character classification helpers for agent harness text scans.
 *
 * @module
 */

//region Character predicates

/**
 * Whether a one-character string is an ASCII digit `0` to `9`.
 *
 * @param c - one-character string to test
 *
 * @returns whether character is in `0` to `9`
 *
 * @example
 * ```ts
 * isDigit('4'); // true
 * isDigit('a'); // false
 * ```
 */
function isDigit(c: string,): boolean {
  return (c >= '0') && (c <= '9');
}

/**
 * Whether a one-character string is an ASCII lowercase letter `a` to `z`.
 *
 * @param c - one-character string to test
 *
 * @returns whether character is in `a` to `z`
 *
 * @example
 * ```ts
 * isLowerAlpha('a'); // true
 * isLowerAlpha('A'); // false
 * ```
 */
function isLowerAlpha(c: string,): boolean {
  return (c >= 'a') && (c <= 'z');
}

/**
 * Whether a one-character string is an ASCII uppercase letter `A` to `Z`.
 *
 * @param c - one-character string to test
 *
 * @returns whether character is in `A` to `Z`
 *
 * @example
 * ```ts
 * isUpperAlpha('A'); // true
 * isUpperAlpha('a'); // false
 * ```
 */
function isUpperAlpha(c: string,): boolean {
  return (c >= 'A') && (c <= 'Z');
}

/**
 * Whether a one-character string is an ASCII alphanumeric letter or digit.
 *
 * @param c - one-character string to test
 *
 * @returns whether character is ASCII alphanumeric
 *
 * @example
 * ```ts
 * isAlphaNum('Z'); // true
 * isAlphaNum('_'); // false
 * ```
 */
function isAlphaNum(c: string,): boolean {
  return isLowerAlpha(c,)
    || isUpperAlpha(c,)
    || isDigit(c,);
}

/**
 * Whether a one-character string is a JavaScript regex `\w` ASCII word character.
 *
 * @param c - one-character string to test
 *
 * @returns whether character is alphanumeric or `_`
 *
 * @example
 * ```ts
 * isWordChar('a'); // true
 * isWordChar('_'); // true
 * isWordChar('-'); // false
 * ```
 */
function isWordChar(c: string,): boolean {
  return isAlphaNum(c,)
    || (c === '_');
}

/**
 * Whether a one-character string is JavaScript-style whitespace.
 *
 * Covers space, tab, newline, carriage return, form feed, and vertical tab.
 *
 * @param c - one-character string to test
 *
 * @returns whether character is whitespace
 *
 * @example
 * ```ts
 * isWhitespace(' '); // true
 * isWhitespace('a'); // false
 * ```
 */
function isWhitespace(c: string,): boolean {
  return (c === ' ')
    || (c === '\t')
    || (c === '\n')
    || (c === '\r')
    || (c === '\f')
    || (c === '\v');
}

//endregion Character predicates

export {
  isAlphaNum,
  isDigit,
  isLowerAlpha,
  isUpperAlpha,
  isWhitespace,
  isWordChar,
};
