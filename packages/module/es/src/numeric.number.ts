import type {
  NegativeFloat,
  PositiveFloat,
} from './numeric.float.ts';
import type {
  NegativeInt,
  PositiveInt,
} from './numeric.int.ts';

/**
 * Union type for all positive numbers (integers and floats).
 * Combines PositiveInt and PositiveFloat for flexible positive number handling.
 *
 * @example
 * ```ts
 * function processPositiveValue(value: PositiveNumber): number {
 *   return value * 2;
 * }
 *
 * const intValue = 5 as PositiveInt;
 * const floatValue = 3.14 as PositiveFloat;
 * processPositiveValue(intValue);   // OK
 * processPositiveValue(floatValue); // OK
 * ```
 */
export type PositiveNumber = PositiveInt | PositiveFloat;

/**
 * Union type for all negative numbers (integers and floats).
 * Combines NegativeInt and NegativeFloat for flexible negative number handling.
 *
 * @example
 * ```ts
 * function processLoss(value: NegativeNumber): PositiveNumber {
 *   return Math.abs(value) as PositiveNumber;
 * }
 *
 * const intLoss = -100 as NegativeInt;
 * const floatLoss = -25.5 as NegativeFloat;
 * processLoss(intLoss);   // 100
 * processLoss(floatLoss); // 25.5
 * ```
 */
export type NegativeNumber = NegativeInt | NegativeFloat;

/**
 * Type guard that checks if a value is a number type using JavaScript typeof operator.
 *
 * This function provides precise type narrowing for number types, including NaN, Infinity,
 * and all finite numbers. Uses generic types to preserve the exact input type when the
 * value is confirmed to be a number. Essential for type-safe numeric operations.
 *
 * @template T - Type of value to check
 * @param value - Value to test for number type
 * @returns True if value is a number (including NaN and Infinity), false otherwise
 *
 * @example
 * Basic number checking:
 * ```ts
 * console.log(isNumber(42)); // true
 * console.log(isNumber("42")); // false
 * console.log(isNumber(NaN)); // true
 * console.log(isNumber(Infinity)); // true
 * ```
 *
 * @example
 * Type narrowing in conditional logic:
 * ```ts
 * function processValue(value: unknown) {
 *   if (isNumber(value)) {
 *     // value is now typed as number
 *     return value * 2; // TypeScript knows this is safe
 *   }
 *   return 0;
 * }
 * ```
 *
 * @example
 * Working with arrays and filtering:
 * ```ts
 * const mixed = [1, "2", 3, null, 4.5, undefined];
 * const numbers = mixed.filter(isNumber);
 * console.log(numbers); // [1, 3, 4.5] - only actual numbers
 * ```
 */
export function isNumber<T,>(
  value: T,
): value is T extends number ? T : never {
  return typeof value === 'number';
}
