// See https://stackoverflow.com/a/79468119
/**
 * Type representing any non-empty string.
 * Template literal type that ensures string contains at least one character.
 * @example
 * ```ts
 * const valid: $ = 'a'; // Valid - non-empty string
 * const alsoValid: $ = 'hello'; // Valid - non-empty string
 *
 * // @ts-expect-error - Empty string is not assignable
 * const invalid: $ = '';
 * ```
 */
export type $ = `${any}${string}`;

const _one: $ = '1';
const _two: $ = '12';

// @ts-expect-error -- Type '""' is not assignable to type '`${any}${string}`'.ts(2322)
const _empty: $ = '';

// No need for a runtime type guard because TypeScript's static type checking will immediately flag any empty string passed to a function that expects $.
