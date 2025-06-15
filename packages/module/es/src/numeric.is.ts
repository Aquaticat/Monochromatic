import type {
  NegativeInfinity,
  PositiveInfinity,
} from 'type-fest';
import type {
  Float,
  Int,
  IntBigint,
  NegativeFloat,
  NegativeInt,
  NonNegativeInt,
  PositiveFloat,
  PositiveInt,
} from './numeric.type.int.ts';
import type { Nan } from './numeric.type.nan';

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
/* @__NO_SIDE_EFFECTS__ */ export function isNumber<T,>(
  value: T,
): value is T extends number ? T : never {
  return typeof value === 'number';
}

/**
 * Type guard that checks if a value is NaN (Not a Number) using JavaScript Number.isNaN.
 *
 * This function specifically detects the NaN value, which is the only JavaScript value
 * that isn't equal to itself. More reliable than global isNaN() which coerces values.
 * Essential for handling mathematical edge cases and validating numeric computations.
 *
 * @param value - Value to test for NaN
 * @returns True if value is exactly NaN, false otherwise
 *
 * @example
 * Basic NaN detection:
 * ```ts
 * console.log(isNan(NaN)); // true
 * console.log(isNan(42)); // false
 * console.log(isNan("hello")); // false (not coerced like global isNaN)
 * ```
 *
 * @example
 * Validating mathematical operations:
 * ```ts
 * function safeDivision(a: number, b: number): number | null {
 *   const result = a / b;
 *   return isNan(result) ? null : result;
 * }
 *
 * console.log(safeDivision(10, 0)); // Infinity (not NaN)
 * console.log(safeDivision(0, 0)); // null (was NaN)
 * ```
 *
 * @example
 * Filtering out invalid calculations:
 * ```ts
 * const calculations = [1/1, 0/0, 5/2, Math.sqrt(-1)];
 * const validResults = calculations.filter(result => !isNan(result));
 * console.log(validResults); // [1, 2.5] - excludes NaN values
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isNan(
  value: any,
): value is Nan {
  return Number.isNaN(value);
}

/**
 * Type guard that checks if a value is an integer using JavaScript Number.isInteger.
 *
 * @deprecated Use `isInt` instead.
 * @param value - Value to test for integer type
 * @returns True if value is an integer, false otherwise
 */
export function isInteger(
  value: unknown,
): value is Int {
  return Number.isInteger(value);
}

/**
 * Type guard that checks if a value is an integer using JavaScript Number.isInteger.
 *
 * This function determines if a number is an integer (whole number without fractional part).
 * Handles edge cases like finite numbers, excludes NaN and Infinity. More precise than
 * modulo operations for integer detection. Essential for mathematical operations requiring
 * whole numbers.
 *
 * @param value - Value to test for integer type
 * @returns True if value is an integer, false otherwise
 *
 * @example
 * Basic integer checking:
 * ```ts
 * console.log(isInt(42)); // true
 * console.log(isInt(42.0)); // true (42.0 === 42)
 * console.log(isInt(42.5)); // false
 * console.log(isInt("42")); // false
 * ```
 *
 * @example
 * Filtering arrays for integers:
 * ```ts
 * const numbers = [1, 2.5, 3, 4.7, 5];
 * const integers = numbers.filter(isInt);
 * console.log(integers); // [1, 3, 5]
 * ```
 *
 * @example
 * Validating user input:
 * ```ts
 * function processIntegerInput(input: unknown): number | null {
 *   if (isInt(input) && input >= 0) {
 *     return input; // TypeScript knows input is number
 *   }
 *   return null;
 * }
 * ```
 *
 * @example
 * Mathematical operations requiring integers:
 * ```ts
 * function factorial(n: unknown): number {
 *   if (!isInt(n) || n < 0) {
 *     throw new Error("Factorial requires non-negative integer");
 *   }
 *   return n === 0 ? 1 : n * factorial(n - 1);
 * }
 * ```
 */
export function isInt(
  value: unknown,
): value is Int {
  return Number.isInteger(value);
}

/**
 * Type guard that checks if a value is a positive integer (greater than zero).
 *
 * This function combines integer checking with positivity validation, ensuring the value
 * is both a whole number and greater than zero. Useful for validating counts, indices,
 * and other scenarios requiring positive whole numbers. Excludes zero and negative integers.
 *
 * @param value - Value to test for positive integer type
 * @returns True if value is a positive integer, false otherwise
 *
 * @example
 * Basic positive integer checking:
 * ```ts
 * console.log(isPositiveInt(5)); // true
 * console.log(isPositiveInt(0)); // false
 * console.log(isPositiveInt(-3)); // false
 * console.log(isPositiveInt(2.5)); // false
 * ```
 *
 * @example
 * Validating array indices:
 * ```ts
 * function safeArrayAccess<T>(arr: T[], index: unknown): T | undefined {
 *   if (isPositiveInt(index) && index < arr.length) {
 *     return arr[index];
 *   }
 *   return undefined;
 * }
 * ```
 *
 * @example
 * Counting and quantity validation:
 * ```ts
 * function createItems(count: unknown): string[] {
 *   if (!isPositiveInt(count)) {
 *     throw new Error("Count must be a positive integer");
 *   }
 *   return Array(count).fill(0).map((_, i) => `Item ${i + 1}`);
 * }
 * ```
 */
export function isPositiveInt(value: unknown): value is PositiveInt {
  return isInt(value) && value > 0;
}

/**
 * Type guard that checks if a value is a negative integer (less than zero).
 *
 * This function combines integer checking with negativity validation, ensuring the value
 * is both a whole number and less than zero. Useful for validating offsets, debts,
 * and other scenarios requiring negative whole numbers. Excludes zero and positive integers.
 *
 * @param value - Value to test for negative integer type
 * @returns True if value is a negative integer, false otherwise
 *
 * @example
 * Basic negative integer checking:
 * ```ts
 * console.log(isNegativeInt(-5)); // true
 * console.log(isNegativeInt(0)); // false
 * console.log(isNegativeInt(3)); // false
 * console.log(isNegativeInt(-2.5)); // false
 * ```
 *
 * @example
 * Handling debt or deficit calculations:
 * ```ts
 * function processDebt(amount: unknown): string {
 *   if (isNegativeInt(amount)) {
 *     return `Debt: $${Math.abs(amount)}`;
 *   }
 *   return "No debt";
 * }
 * ```
 *
 * @example
 * Array offset calculations:
 * ```ts
 * function getFromEnd<T>(arr: T[], offset: unknown): T | undefined {
 *   if (isNegativeInt(offset)) {
 *     const index = arr.length + offset; // offset is negative
 *     return index >= 0 ? arr[index] : undefined;
 *   }
 *   return undefined;
 * }
 * ```
 */
export function isNegativeInt(value: unknown): value is NegativeInt {
  return isInt(value) && value < 0;
}

/**
 * Type guard that checks if a value is a non-negative integer (zero or positive).
 *
 * This function combines integer checking with non-negativity validation, ensuring the value
 * is both a whole number and greater than or equal to zero. Useful for validating counts,
 * array lengths, and other scenarios requiring non-negative whole numbers. Includes zero.
 *
 * @param value - Value to test for non-negative integer type
 * @returns True if value is a non-negative integer, false otherwise
 *
 * @example
 * Basic non-negative integer checking:
 * ```ts
 * console.log(isNonNegativeInt(0)); // true
 * console.log(isNonNegativeInt(5)); // true
 * console.log(isNonNegativeInt(-3)); // false
 * console.log(isNonNegativeInt(2.5)); // false
 * ```
 *
 * @example
 * Validating array lengths and counts:
 * ```ts
 * function validateCount(count: unknown): boolean {
 *   return isNonNegativeInt(count) && count <= 1000;
 * }
 *
 * console.log(validateCount(0)); // true (empty is valid)
 * console.log(validateCount(10)); // true
 * console.log(validateCount(-1)); // false
 * ```
 *
 * @example
 * Age validation (including babies):
 * ```ts
 * function isValidAge(age: unknown): age is NonNegativeInt {
 *   return isNonNegativeInt(age) && age <= 150;
 * }
 * ```
 */
export function isNonNegativeInt(value: unknown): value is NonNegativeInt {
  return isInt(value) && value >= 0;
}

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
  return isNonNanNumber(value) && Number.isFinite(value) && !Number.isInteger(value);
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
  return isFloat(value) && value > 0;
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
  return isFloat(value) && value < 0;
}

/**
 * Type guard that checks if a value is a number but not NaN.
 *
 * This function ensures the value is a number type while excluding the special NaN value.
 * Essential for mathematical operations that require valid numeric inputs. More precise
 * than basic number checking when NaN values need to be filtered out. Uses generic types
 * for precise type narrowing.
 *
 * @template T - Type of value to check
 * @param value - Value to test for non-NaN number type
 * @returns True if value is a number and not NaN, false otherwise
 *
 * @example
 * Basic non-NaN number checking:
 * ```ts
 * console.log(isNonNanNumber(42)); // true
 * console.log(isNonNanNumber(3.14)); // true
 * console.log(isNonNanNumber(NaN)); // false
 * console.log(isNonNanNumber("42")); // false
 * console.log(isNonNanNumber(Infinity)); // true
 * ```
 *
 * @example
 * Validating calculation results:
 * ```ts
 * function safeCalculation(a: number, b: number): number | null {
 *   const result = Math.sqrt(a) + Math.log(b);
 *   return isNonNanNumber(result) ? result : null;
 * }
 * ```
 *
 * @example
 * Filtering arrays for valid numbers:
 * ```ts
 * const values = [1, NaN, 3.14, 0/0, 42, Math.sqrt(-1)];
 * const validNumbers = values.filter(isNonNanNumber);
 * console.log(validNumbers); // [1, 3.14, 42]
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isNonNanNumber<T,>(
  value: T,
): value is Exclude<T extends number ? T : never, typeof Number.NaN> {
  return isNumber(value) && !isNan(value);
}

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
  value: any,
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
  value: any,
): value is PositiveInfinity {
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
  return isPositiveInfinity(value) || isNegativeInfinity(value);
}

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
  return !isInfinity(value) && isNonNanNumber(value);
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
  return isFiniteNumber(value)
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
  return isPositiveInfinity(value) || isPositiveInt(value) || isPositiveFloat(value);
}

/**
 * Type guard that checks if a value is a Date object using Object.prototype.toString.
 *
 * This function uses the most reliable method for detecting Date objects by checking
 * the internal [[Class]] property via Object.prototype.toString. More reliable than
 * instanceof Date for cross-frame scenarios and corrupted Date objects. Essential
 * for validating date inputs and temporal data processing.
 *
 * @param value - Value to test for Date object type
 * @returns True if value is a Date object, false otherwise
 *
 * @example
 * Basic Date object checking:
 * ```ts
 * console.log(isObjectDate(new Date())); // true
 * console.log(isObjectDate(new Date("2023-01-01"))); // true
 * console.log(isObjectDate("2023-01-01")); // false
 * console.log(isObjectDate(1234567890000)); // false (timestamp)
 * console.log(isObjectDate({})); // false
 * ```
 *
 * @example
 * Validating user input for date operations:
 * ```ts
 * function formatDate(input: unknown): string {
 *   if (isObjectDate(input)) {
 *     return input.toISOString().split('T')[0];
 *   }
 *   return "Invalid date";
 * }
 * ```
 *
 * @example
 * Filtering arrays for Date objects:
 * ```ts
 * const mixed = [new Date(), "2023-01-01", 1234567890, new Date("invalid")];
 * const dates = mixed.filter(isObjectDate);
 * const validDates = dates.filter(date => !isNaN(date.getTime()));
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function isObjectDate(value: any): value is Date {
  return Object.prototype.toString.call(value) === '[object Date]';
}

/**
 * Type guard that checks if a value is a bigint type using JavaScript typeof operator.
 *
 * This function provides precise type narrowing for bigint values, which are used
 * for arbitrary-precision integer arithmetic in JavaScript. Essential for handling
 * large integers that exceed the safe integer range of regular numbers. Enables
 * type-safe operations with bigint values.
 *
 * @param value - Value to test for bigint type
 * @returns True if value is a bigint, false otherwise
 *
 * @example
 * Basic bigint checking:
 * ```ts
 * console.log(isBigint(100n)); // true
 * console.log(isBigint(BigInt(100))); // true
 * console.log(isBigint(100)); // false
 * console.log(isBigint("100")); // false
 * ```
 *
 * @example
 * Working with large numbers:
 * ```ts
 * function processLargeNumber(value: unknown): string {
 *   if (isBigint(value)) {
 *     return `Large number: ${value.toString()}`;
 *   }
 *   return "Not a bigint";
 * }
 * ```
 *
 * @example
 * Type-safe arithmetic operations:
 * ```ts
 * function addIfBigint(a: unknown, b: unknown): bigint | null {
 *   if (isBigint(a) && isBigint(b)) {
 *     return a + b; // TypeScript knows these are bigints
 *   }
 *   return null;
 * }
 * ```
 */
export function isBigint(value: unknown): value is bigint {
  return typeof value === 'bigint';
}

/**
 * Type guard that checks if a value is numeric (either number or bigint).
 *
 * This function provides comprehensive checking for any numeric type in JavaScript,
 * including both regular numbers and bigint values. Essential for functions that
 * can work with either numeric type and need to validate input before mathematical
 * operations. Enables polymorphic numeric handling.
 *
 * @param value - Value to test for numeric type
 * @returns True if value is number or bigint, false otherwise
 *
 * @example
 * Basic numeric type checking:
 * ```ts
 * console.log(isNumeric(42)); // true (number)
 * console.log(isNumeric(100n)); // true (bigint)
 * console.log(isNumeric("42")); // false
 * console.log(isNumeric(null)); // false
 * console.log(isNumeric(NaN)); // true (NaN is a number)
 * ```
 *
 * @example
 * Polymorphic arithmetic functions:
 * ```ts
 * function addNumeric(a: unknown, b: unknown): number | bigint | null {
 *   if (isNumeric(a) && isNumeric(b)) {
 *     if (typeof a === 'bigint' || typeof b === 'bigint') {
 *       return BigInt(a) + BigInt(b);
 *     }
 *     return Number(a) + Number(b);
 *   }
 *   return null;
 * }
 * ```
 *
 * @example
 * Filtering mixed arrays for numeric values:
 * ```ts
 * const mixed = [1, "2", 3n, null, 4.5, undefined, 100n];
 * const numbers = mixed.filter(isNumeric);
 * console.log(numbers); // [1, 3n, 4.5, 100n]
 * ```
 */
export function isNumeric(value: unknown): value is number | bigint {
  return isNumber(value) || isBigint(value);
}

/**
 * Type guard that checks if a bigint value is within the safe integer range.
 *
 * This function determines if a bigint value falls within the range that can be
 * safely represented as a JavaScript number without precision loss. Useful for
 * validating bigint values before potential conversion to number type or for
 * ensuring compatibility with number-based APIs.
 *
 * @param value - Value to test for safe-range bigint
 * @returns True if value is a bigint within safe integer range, false otherwise
 *
 * @example
 * Basic safe bigint checking:
 * ```ts
 * console.log(isIntBigint(100n)); // true
 * console.log(isIntBigint(BigInt(Number.MAX_SAFE_INTEGER))); // true
 * console.log(isIntBigint(BigInt(Number.MAX_SAFE_INTEGER) + 1n)); // false
 * console.log(isIntBigint(BigInt(Number.MIN_SAFE_INTEGER))); // true
 * console.log(isIntBigint(100)); // false (not a bigint)
 * ```
 *
 * @example
 * Safe conversion to number:
 * ```ts
 * function bigintToNumber(value: unknown): number | null {
 *   if (isIntBigint(value)) {
 *     return Number(value); // Safe conversion
 *   }
 *   return null;
 * }
 * ```
 *
 * @example
 * Database compatibility checks:
 * ```ts
 * function canStoreInDatabase(id: unknown): boolean {
 *   return isIntBigint(id) || (isNumber(id) && isSafeNumber(id));
 * }
 * ```
 */
export function isIntBigint(value: unknown): value is IntBigint {
  return isBigint(value)
    && value >= BigInt(Number.MIN_SAFE_INTEGER)
    && value <= BigInt(Number.MAX_SAFE_INTEGER);
}

/**
 * Constant representing the bigint value of zero.
 *
 * This constant provides a convenient reference to the bigint zero value, useful for
 * mathematical operations, comparisons, and as a default value in bigint computations.
 * Eliminates the need to repeatedly write `0n` and provides a named constant for
 * better code readability and maintenance.
 *
 * @example
 * Using as a default value:
 * ```ts
 * function sumBigints(values: bigint[]): bigint {
 *   return values.reduce((sum, val) => sum + val, bigint0);
 * }
 * ```
 *
 * @example
 * Comparison operations:
 * ```ts
 * function isPositiveBigint(value: bigint): boolean {
 *   return value > bigint0;
 * }
 * ```
 *
 * @example
 * Initialization and reset operations:
 * ```ts
 * let counter: bigint = bigint0;
 * function resetCounter(): void {
 *   counter = bigint0;
 * }
 * ```
 */
export const bigint0 = 0n;
