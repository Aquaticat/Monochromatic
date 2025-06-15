/**
 * Returns the logical NOT of a value's truthiness.
 * This function applies JavaScript's truthiness rules and returns the negated boolean result.
 * Useful for converting truthy values to false and falsy values to true.
 *
 * @param value - Value to negate
 * @returns Negated boolean representation of the value's truthiness
 *
 * @example
 * ```ts
 * BooleanNot(true); // false
 * BooleanNot(false); // true
 * BooleanNot(1); // false (1 is truthy)
 * BooleanNot(0); // true (0 is falsy)
 * BooleanNot('hello'); // false (non-empty string is truthy)
 * BooleanNot(''); // true (empty string is falsy)
 * BooleanNot(null); // true (null is falsy)
 * BooleanNot(undefined); // true (undefined is falsy)
 * BooleanNot([]); // false (arrays are truthy, even empty ones)
 * BooleanNot({}); // false (objects are truthy, even empty ones)
 * ```
 */
export function BooleanNot(value: unknown): boolean {
  return !value;
}
