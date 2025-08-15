//region General String Types -- General utility string types

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
export type NonEmptyString = `${string}${string}`;

//endregion General String Types