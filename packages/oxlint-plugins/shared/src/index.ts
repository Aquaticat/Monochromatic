/**
 * Shared runtime primitives for oxlint plugin packages.
 *
 * These helpers live in a shipped package because plugin rules call them while
 * linting user source. Test-only helpers belong in
 * `@monochromatic-dev/config-oxlint-test-support` instead.
 *
 * @module
 */

/**
 * Readonly view of an untyped object's string-keyed fields.
 */
export type ReadonlyRecord = Readonly<Record<string, unknown>>;

/**
 * Checks whether `char` is ASCII whitespace per JavaScript `\s` semantics used
 * by the plugin scanners.
 *
 * @param char - candidate character
 *
 * @returns whether `char` is space, tab, newline, carriage return, form feed, or vertical tab
 *
 * @example
 * ```ts
 * isWhitespaceChar(' '); // true
 * isWhitespaceChar('x'); // false
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
 * Checks whether `char` is an ASCII word character.
 *
 * @param char - candidate character
 *
 * @returns whether `char` qualifies as `[A-Za-z0-9_]`
 *
 * @example
 * ```ts
 * isWordChar('a'); // true
 * isWordChar('-'); // false
 * ```
 */
export function isWordChar(char: string,): boolean {
  return ((char >= '0') && (char <= '9'))
    || ((char >= 'a') && (char <= 'z'))
    || ((char >= 'A') && (char <= 'Z'))
    || (char === '_');
}

/**
 * Narrows an unknown value to a readonly record-like object.
 *
 * @param value - candidate runtime value
 *
 * @returns whether `value` is non-null object data with inspectable fields
 *
 * @example
 * ```ts
 * if (isRecord(value)) {
 *   value.type;
 * }
 * ```
 */
export function isRecord(value: unknown,): value is ReadonlyRecord {
  return ((typeof value) === 'object') && (value !== null);
}
