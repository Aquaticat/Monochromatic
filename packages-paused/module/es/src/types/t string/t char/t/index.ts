/**
 * Type representing a single character string.
 * This intersection type constrains a string to have exactly one character length.
 *
 * While TypeScript cannot statically infer string length at compile time for most cases,
 * this type provides a runtime-enforced constraint through type assertions.
 * It functions similarly to a branded type but leverages the existing string length property.
 *
 * @example
 * ```ts
 * // Valid single character with type assertion
 * const char: $ = 'a' as $;
 *
 * // \@ts-expect-error - Multiple characters are not assignable
 * const invalid: $ = 'ab';
 *
 * // \@ts-expect-error - Empty string is not assignable
 * const empty: $ = '';
 * ```
 */
export type $ = string & { length: 1; };

/**
 * Compile-time test: single character passes via type assertion.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- compile-time test narrowing string literal to branded Char type
const _one: $ = '1' as $;

/**
 * Compile-time test: multi-character string fails assignment.
 */
// @ts-expect-error; Type 'string' is not assignable to type '$'. Type 'string' is not assignable to type '{ length: 1; }'.ts(2322)
const _two: $ = '12';

/**
 * Compile-time test: empty string fails assignment.
 */
// @ts-expect-error; Type 'string' is not assignable to type '$'. Type 'string' is not assignable to type '{ length: 1; }'.ts(2322)
const _empty: $ = '';
