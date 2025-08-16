import type {
  NegativeInfinity,
  PositiveInfinity,
} from 'type-fest';

/**
 * Type guard that checks if a value is positive infinity.
 *
 * This function specifically detects the Number.POSITIVE_INFINITY value, which represents
 * mathematical positive infinity in JavaScript. Essential for handling mathematical
 * edge cases, division by zero results, and overflow conditions in calculations.
 *
 * @param value - Value to test for positive infinity
 * @returns True if value is exactly positive infinity, false otherwise
 *
 * @example
 * Basic positive infinity checking:
 * ```ts
 * console.log(isPositiveInfinity(Infinity)); // true
 * console.log(isPositiveInfinity(Number.POSITIVE_INFINITY)); // true
 * console.log(isPositiveInfinity(-Infinity)); // false
 * console.log(isPositiveInfinity(1000000)); // false
 * ```
 *
 * @example
 * Handling division results:
 * ```ts
 * function safeDivide(a: number, b: number): number | string {
 *   const result = a / b;
 *   if (isPositiveInfinity(result)) {
 *     return "Positive overflow";
 *   }
 *   return result;
 * }
 * ```
 *
 * @example
 * Mathematical limit detection:
 * ```ts
 * function checkLimit(value: number): string {
 *   if (isPositiveInfinity(value)) {
 *     return "Approaches positive infinity";
 *   }
 *   return `Finite value: ${value}`;
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isPositiveInfinity(
  value: unknown,
): value is PositiveInfinity {
  return value === Number.POSITIVE_INFINITY;
}

/**
 * Type guard that checks if a value is negative infinity.
 *
 * This function specifically detects the Number.NEGATIVE_INFINITY value, which represents
 * mathematical negative infinity in JavaScript. Essential for handling mathematical
 * edge cases, negative division by zero results, and underflow conditions in calculations.
 *
 * @param value - Value to test for negative infinity
 * @returns True if value is exactly negative infinity, false otherwise
 *
 * @example
 * Basic negative infinity checking:
 * ```ts
 * console.log(isNegativeInfinity(-Infinity)); // true
 * console.log(isNegativeInfinity(Number.NEGATIVE_INFINITY)); // true
 * console.log(isNegativeInfinity(Infinity)); // false
 * console.log(isNegativeInfinity(-1000000)); // false
 * ```
 *
 * @example
 * Handling negative division results:
 * ```ts
 * function checkDivision(a: number, b: number): string {
 *   const result = a / b;
 *   if (isNegativeInfinity(result)) {
 *     return "Negative overflow";
 *   }
 *   return result.toString();
 * }
 * ```
 *
 * @example
 * Range validation with infinity bounds:
 * ```ts
 * function isInValidRange(value: number): boolean {
 *   return !isNegativeInfinity(value) && !isPositiveInfinity(value);
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isNegativeInfinity(
  value: unknown,
): value is NegativeInfinity {
  return value === Number.NEGATIVE_INFINITY;
}

/**
 * Type guard that checks if a value is either positive or negative infinity.
 *
 * This function detects both positive and negative infinity values, providing a
 * comprehensive check for infinite mathematical values. Uses conditional types to
 * preserve the specific infinity type when known. Essential for mathematical
 * boundary condition handling and overflow detection.
 *
 * @template T_value - Type of value to check for infinity
 * @param value - Value to test for any infinity type
 * @returns True if value is positive or negative infinity, false otherwise
 *
 * @example
 * Basic infinity checking:
 * ```ts
 * console.log(isInfinity(Infinity)); // true
 * console.log(isInfinity(-Infinity)); // true
 * console.log(isInfinity(1000000)); // false
 * console.log(isInfinity(NaN)); // false
 * ```
 *
 * @example
 * Mathematical boundary validation:
 * ```ts
 * function validateCalculation(result: number): boolean {
 *   return !isInfinity(result) && !isNan(result);
 * }
 *
 * console.log(validateCalculation(1/0)); // false (infinity)
 * console.log(validateCalculation(Math.sqrt(-1))); // false (NaN)
 * console.log(validateCalculation(42)); // true
 * ```
 *
 * @example
 * Filtering finite values from calculations:
 * ```ts
 * const calculations = [1/0, -1/0, 5*2, 0/0, Math.PI];
 * const finiteResults = calculations.filter(val => !isInfinity(val) && !isNan(val));
 * console.log(finiteResults); // [10, 3.141592653589793]
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isInfinity<T_value,>(
  value: T_value | unknown,
): value is T_value extends PositiveInfinity ? PositiveInfinity
  : T_value extends NegativeInfinity ? NegativeInfinity
  : never
{
  return isPositiveInfinity(value,) || isNegativeInfinity(value,);
}