import type {
  NegativeInfinity,
  PositiveInfinity,
} from 'type-fest';
import { isPositiveFloat, } from './numeric.float.ts';
import {
  isInfinity,
  isPositiveInfinity,
} from './numeric.infinity.ts';
import { isPositiveInt, } from './numeric.int.ts';
import { isNonNanNumber, } from './numeric.nan.ts';

/**
 * Type guard that checks if a value is a finite number (not infinity or NaN).
 *
 * This function ensures the value is a number that's both finite and not NaN,
 * making it safe for mathematical operations that require real numeric values.
 * Combines infinity and NaN exclusion for comprehensive finite number validation.
 * Essential for mathematical computations requiring bounded values.
 *
 * @template T - Type of value to check
 * @param value - Value to test for finite number type
 * @returns True if value is a finite number, false otherwise
 *
 * @example
 * Basic finite number checking:
 * ```ts
 * console.log(isFiniteNumber(42)); // true
 * console.log(isFiniteNumber(3.14)); // true
 * console.log(isFiniteNumber(Infinity)); // false
 * console.log(isFiniteNumber(-Infinity)); // false
 * console.log(isFiniteNumber(NaN)); // false
 * console.log(isFiniteNumber("42")); // false
 * ```
 *
 * @example
 * Validating user input for calculations:
 * ```ts
 * function calculate(a: unknown, b: unknown): number | null {
 *   if (isFiniteNumber(a) && isFiniteNumber(b)) {
 *     return Math.sqrt(a * a + b * b); // Safe calculation
 *   }
 *   return null;
 * }
 * ```
 *
 * @example
 * Data cleaning for statistical analysis:
 * ```ts
 * const rawData = [1, 2.5, Infinity, NaN, -3.7, null, 0];
 * const cleanData = rawData.filter(isFiniteNumber);
 * const average = cleanData.reduce((sum, val) => sum + val, 0) / cleanData.length;
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isFiniteNumber<T,>(
  value: T,
): value is Exclude<T extends number ? T : never,
  PositiveInfinity | NegativeInfinity | typeof Number.NaN>
{
  return !isInfinity(value,) && isNonNanNumber(value,);
}

/**
 * Type guard that checks if a value is a safe number within JavaScript's safe integer range.
 *
 * This function ensures the value is a finite number within the range of
 * Number.MIN_SAFE_INTEGER to Number.MAX_SAFE_INTEGER, where integer arithmetic
 * operations are guaranteed to be precise. Essential for operations requiring
 * exact integer representation without floating-point precision loss.
 *
 * @template T - Type of value to check
 * @param value - Value to test for safe number range
 * @returns True if value is within safe number range, false otherwise
 *
 * @example
 * Basic safe number checking:
 * ```ts
 * console.log(isSafeNumber(42)); // true
 * console.log(isSafeNumber(Number.MAX_SAFE_INTEGER)); // true
 * console.log(isSafeNumber(Number.MAX_SAFE_INTEGER + 1)); // false
 * console.log(isSafeNumber(Number.MIN_SAFE_INTEGER)); // true
 * console.log(isSafeNumber(Number.MIN_SAFE_INTEGER - 1)); // false
 * ```
 *
 * @example
 * Validating integer operations:
 * ```ts
 * function safeIntegerOperation(a: unknown, b: unknown): number | null {
 *   if (isSafeNumber(a) && isSafeNumber(b)) {
 *     const result = a + b;
 *     return isSafeNumber(result) ? result : null;
 *   }
 *   return null;
 * }
 * ```
 *
 * @example
 * Database ID validation:
 * ```ts
 * function isValidDatabaseId(id: unknown): boolean {
 *   return isSafeNumber(id) && Number.isInteger(id) && id > 0;
 * }
 * ```
 */
// Can't type that range.
/* @__NO_SIDE_EFFECTS__ */ export function isSafeNumber<T,>(
  value: T,
): value is Exclude<T extends number ? T : never,
  PositiveInfinity | NegativeInfinity | typeof Number.NaN>
{
  return isFiniteNumber(value,)
    && (-Number.MAX_SAFE_INTEGER <= value && value <= Number.MAX_SAFE_INTEGER);
}

/**
 * Type guard that checks if a value is any positive number (integer, float, or infinity).
 *
 * This function provides comprehensive checking for positive numeric values,
 * including positive integers, positive floating-point numbers, and positive infinity.
 * Uses existing type guards for consistent behavior across different number types.
 * Essential for validating amounts, quantities, and measurements.
 *
 * @template T - Type of value to check
 * @param value - Value to test for positive number type
 * @returns True if value is any positive number, false otherwise
 *
 * @example
 * Basic positive number checking:
 * ```ts
 * console.log(isPositiveNumber(5)); // true (positive integer)
 * console.log(isPositiveNumber(3.14)); // true (positive float)
 * console.log(isPositiveNumber(Infinity)); // true (positive infinity)
 * console.log(isPositiveNumber(0)); // false
 * console.log(isPositiveNumber(-5)); // false
 * console.log(isPositiveNumber(NaN)); // false
 * ```
 *
 * @example
 * Validating measurements and quantities:
 * ```ts
 * function validateQuantity(qty: unknown): boolean {
 *   return isPositiveNumber(qty) && qty !== Infinity;
 * }
 *
 * function calculateTotal(quantities: unknown[]): number {
 *   return quantities
 *     .filter(isPositiveNumber)
 *     .filter(qty => qty !== Infinity)
 *     .reduce((sum, qty) => sum + qty, 0);
 * }
 * ```
 *
 * @example
 * Financial amount validation:
 * ```ts
 * function isValidAmount(amount: unknown): boolean {
 *   return isPositiveNumber(amount) && isFiniteNumber(amount);
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isPositiveNumber<T,>(
  value: T,
): value is T extends number ? T : never {
  return isPositiveInfinity(value,) || isPositiveInt(value,) || isPositiveFloat(value,);
}
