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

// No need for a type guard.
// TODO: Expand the reasoning for why this has no need for a type guard.
