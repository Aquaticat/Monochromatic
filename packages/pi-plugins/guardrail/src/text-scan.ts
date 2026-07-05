/**
 * Regex-free character predicates for guardrail scans.
 *
 * @module
 */

//region Character predicates

/**
 * Detects ASCII digits.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character is `0` to `9`
 *
 * @example
 * ```typescript
 * isDigit('4'); // true
 * ```
 */
function isDigit(c: string,): boolean {
  return (c >= '0') && (c <= '9');
}

/**
 * Detects lowercase ASCII letters.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character is `a` to `z`
 *
 * @example
 * ```typescript
 * isLowerAlpha('a'); // true
 * ```
 */
function isLowerAlpha(c: string,): boolean {
  return (c >= 'a') && (c <= 'z');
}

/**
 * Detects uppercase ASCII letters.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character is `A` to `Z`
 *
 * @example
 * ```typescript
 * isUpperAlpha('A'); // true
 * ```
 */
function isUpperAlpha(c: string,): boolean {
  return (c >= 'A') && (c <= 'Z');
}

/**
 * Detects ASCII alphanumeric characters.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character is a letter or digit
 *
 * @example
 * ```typescript
 * isAlphaNum('Z'); // true
 * ```
 */
function isAlphaNum(c: string,): boolean {
  return isLowerAlpha(c,)
    || isUpperAlpha(c,)
    || isDigit(c,);
}

/**
 * Detects ASCII word characters.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character is alphanumeric or underscore
 *
 * @example
 * ```typescript
 * isWordChar('_'); // true
 * ```
 */
function isWordChar(c: string,): boolean {
  return isAlphaNum(c,)
    || (c === '_');
}

/**
 * Detects JavaScript regex-style whitespace without invoking regex.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character is whitespace
 *
 * @example
 * ```typescript
 * isWhitespace(' '); // true
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
  isWhitespace,
  isWordChar,
};
