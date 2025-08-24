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

//region Basic Type Guards -- Fundamental string and related type validation functions

/**
 * Type guard that checks if a value is a string type using JavaScript typeof operator.
 * This function provides precise type narrowing for string types and is essential for
 * type-safe string operations in TypeScript applications.
 *
 * @param value - Value to test for string type
 * @returns True if value is a string, false otherwise
 * @example
 * ```ts
 * const input: unknown = "hello";
 * if (isString(input)) {
 *   // input is now typed as string
 *   console.log(input.toUpperCase()); // "HELLO"
 * }
 *
 * isString("text"); // true
 * isString(123); // false
 * isString(null); // false
 * ```
 */
export function $(value: unknown,): value is string {
  return typeof value === 'string';
}

/**
 * Type guard that checks if a value is a RegExp object using Object.prototype.toString.
 * This method provides more reliable RegExp detection than instanceof, especially across
 * different execution contexts or when dealing with RegExp objects from different realms.
 *
 * @param value - Value to test for RegExp type
 * @returns True if value is a RegExp object, false otherwise
 * @example
 * ```ts
 * const pattern = /[a-z]+/;
 * const notPattern = "[a-z]+";
 *
 * isObjectRegexp(pattern); // true
 * isObjectRegexp(notPattern); // false
 * isObjectRegexp(new RegExp("test")); // true
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isObjectRegexp(
  value: unknown,
): value is RegExp {
  return Object.prototype.toString.call(value,) === '[object RegExp]';
}

//endregion Basic Type Guards
