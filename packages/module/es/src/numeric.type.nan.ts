/**
 * Type alias representing the NaN (Not-a-Number) value.
 * Provides a type-safe way to reference the special IEEE 754 floating-point value
 * that represents an undefined or unrepresentable mathematical result.
 *
 * @example
 * ```ts
 * function parseNumber(input: string): number | Nan {
 *   const result = parseFloat(input);
 *   return Number.isNaN(result) ? Number.NaN : result;
 * }
 *
 * const invalidNumber: Nan = Number.NaN; // Valid
 * const validNumber: number = 42;         // Valid
 *
 * // Type guard for NaN checking
 * function isNan(value: number): value is Nan {
 *   return Number.isNaN(value);
 * }
 *
 * // Usage in mathematical operations
 * const result = Math.sqrt(-1); // Returns NaN
 * if (isNan(result)) {
 *   console.log("Invalid mathematical operation");
 * }
 * ```
 */
export type Nan = typeof Number.NaN;

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
  value: unknown,
): value is Nan {
  return Number.isNaN(value,);
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
  return isNumber(value,) && !isNan(value,);
}
