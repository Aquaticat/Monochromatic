import { isNumber, } from './numeric.number.ts';

/**
 * Branded type for bigint values representing integers.
 * Provides compile-time guarantees for large integer operations using bigint.
 *
 * @example
 * ```ts
 * function processLargeNumber(value: IntBigint): string {
 *   return `Large number: ${value}`;
 * }
 *
 * const largeInt = 9007199254740991n as IntBigint;
 * processLargeNumber(largeInt);
 * ```
 */
export type IntBigint = bigint & { __brand: 'IntBigint'; };

/**
 * Union type for all numeric types (number and bigint).
 * Provides flexibility for functions that can work with both regular numbers and bigints.
 *
 * @example
 * ```ts
 * function convertToString(value: Numeric): string {
 *   return value.toString();
 * }
 *
 * convertToString(42);    // "42"
 * convertToString(42n);   // "42"
 * convertToString(3.14);  // "3.14"
 * ```
 */
export type Numeric = number | bigint;

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
export function isBigint(value: unknown,): value is bigint {
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
export function isNumeric(value: unknown,): value is number | bigint {
  return isNumber(value,) || isBigint(value,);
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
export function isIntBigint(value: unknown,): value is IntBigint {
  return isBigint(value,)
    && value >= BigInt(Number.MIN_SAFE_INTEGER,)
    && value <= BigInt(Number.MAX_SAFE_INTEGER,);
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
