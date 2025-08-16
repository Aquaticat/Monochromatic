import { isNonNanNumber, } from './numeric.nan.ts';

/**
 * Branded type for positive floating-point numbers (numbers greater than 0).
 * Provides compile-time guarantees that values are positive decimal numbers.
 *
 * @example
 * ```ts
 * function calculateArea(radius: PositiveFloat): PositiveFloat {
 *   return (Math.PI * radius * radius) as PositiveFloat;
 * }
 *
 * const radius = 3.14 as PositiveFloat;
 * const area = calculateArea(radius);
 * ```
 */
export type PositiveFloat = number & { __brand: 'PositiveFloat'; };

/**
 * Branded type for negative floating-point numbers (numbers less than 0).
 * Provides compile-time guarantees that values are negative decimal numbers.
 *
 * @example
 * ```ts
 * function processTemperature(temp: NegativeFloat): string {
 *   return `Below freezing: ${temp}°C`;
 * }
 *
 * const temp = -15.5 as NegativeFloat;
 * processTemperature(temp);
 * ```
 */
export type NegativeFloat = number & { __brand: 'NegativeFloat'; };

/**
 * Union type for all floating-point numbers (positive and negative).
 * Combines PositiveFloat and NegativeFloat for decimal number operations.
 *
 * @example
 * ```ts
 * function roundFloat(value: Float): number {
 *   return Math.round(value);
 * }
 *
 * const positive = 3.7 as PositiveFloat;
 * const negative = -2.3 as NegativeFloat;
 * roundFloat(positive); // 4
 * roundFloat(negative); // -2
 * ```
 */
export type Float = PositiveFloat | NegativeFloat;

/**
 * Type guard that checks if a value is a floating-point number (has decimal places).
 *
 * This function determines if a number has a fractional component, excluding integers,
 * NaN, and Infinity. Uses combination of finite checking and integer exclusion to
 * identify true floating-point values. Essential for validating decimal inputs and
 * precise mathematical operations.
 *
 * @param value - Value to test for floating-point type
 * @returns True if value is a float with decimal places, false otherwise
 *
 * @example
 * Basic float checking:
 * ```ts
 * console.log(isFloat(3.14)); // true
 * console.log(isFloat(42)); // false (integer)
 * console.log(isFloat(42.0)); // false (equivalent to integer)
 * console.log(isFloat(NaN)); // false
 * console.log(isFloat(Infinity)); // false
 * ```
 *
 * @example
 * Validating decimal precision:
 * ```ts
 * function requiresPrecision(value: unknown): boolean {
 *   return isFloat(value) && value.toString().split('.')[1].length > 2;
 * }
 *
 * console.log(requiresPrecision(3.14159)); // true
 * console.log(requiresPrecision(3.14)); // false
 * ```
 *
 * @example
 * Financial calculations with decimals:
 * ```ts
 * function formatCurrency(amount: unknown): string {
 *   if (isFloat(amount)) {
 *     return `$${amount.toFixed(2)}`;
 *   }
 *   return "Invalid amount";
 * }
 * ```
 */
export function isFloat(
  value: unknown,
): value is Float {
  return isNonNanNumber(value,) && Number.isFinite(value,) && !Number.isInteger(value,);
}

/**
 * Type guard that checks if a value is a positive floating-point number.
 *
 * This function combines floating-point checking with positivity validation, ensuring
 * the value has decimal places and is greater than zero. Useful for validating
 * measurements, percentages, and other positive decimal values. Excludes zero and
 * negative floats.
 *
 * @param value - Value to test for positive float type
 * @returns True if value is a positive float, false otherwise
 *
 * @example
 * Basic positive float checking:
 * ```ts
 * console.log(isPositiveFloat(3.14)); // true
 * console.log(isPositiveFloat(-2.5)); // false
 * console.log(isPositiveFloat(0.0)); // false
 * console.log(isPositiveFloat(5)); // false (integer)
 * ```
 *
 * @example
 * Validating percentages and rates:
 * ```ts
 * function applyDiscount(price: number, rate: unknown): number {
 *   if (isPositiveFloat(rate) && rate < 1.0) {
 *     return price * (1 - rate);
 *   }
 *   return price;
 * }
 * ```
 *
 * @example
 * Measurement validation:
 * ```ts
 * function validateMeasurement(value: unknown): boolean {
 *   return isPositiveFloat(value) && value < 1000.0;
 * }
 * ```
 */
export function isPositiveFloat(
  value: unknown,
): value is PositiveFloat {
  return isFloat(value,) && value > 0;
}

/**
 * Type guard that checks if a value is a negative floating-point number.
 *
 * This function combines floating-point checking with negativity validation, ensuring
 * the value has decimal places and is less than zero. Useful for validating debts,
 * temperature readings below zero, and other negative decimal values. Excludes zero
 * and positive floats.
 *
 * @param value - Value to test for negative float type
 * @returns True if value is a negative float, false otherwise
 *
 * @example
 * Basic negative float checking:
 * ```ts
 * console.log(isNegativeFloat(-3.14)); // true
 * console.log(isNegativeFloat(2.5)); // false
 * console.log(isNegativeFloat(0.0)); // false
 * console.log(isNegativeFloat(-5)); // false (integer)
 * ```
 *
 * @example
 * Temperature readings:
 * ```ts
 * function isBelowFreezing(temp: unknown): boolean {
 *   return isNegativeFloat(temp) || (isInt(temp) && temp < 0);
 * }
 * ```
 *
 * @example
 * Financial loss calculations:
 * ```ts
 * function calculateLoss(value: unknown): string {
 *   if (isNegativeFloat(value)) {
 *     return `Loss: $${Math.abs(value).toFixed(2)}`;
 *   }
 *   return "No loss";
 * }
 * ```
 */
export function isNegativeFloat(
  value: unknown,
): value is NegativeFloat {
  return isFloat(value,) && value < 0;
}
