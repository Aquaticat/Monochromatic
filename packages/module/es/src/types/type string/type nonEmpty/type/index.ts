/**
 * Template literal type representing a non-empty string.
 * Ensures a string has at least one character.
 *
 * @example
 * ```ts
 * const notEmpty: NonEmptyString = 'hello'; // Valid
 * const invalid: NonEmptyString = ''; // Type error - empty string not allowed
 * ```
 */
export type $ = `${string}${string}`;
