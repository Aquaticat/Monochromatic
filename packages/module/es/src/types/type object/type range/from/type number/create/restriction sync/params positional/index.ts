/**
 * Creates a range object with inclusive start and end boundaries.
 * Validates that the end value is greater than or equal to the start value.
 * Supports both integer and floating-point number ranges for flexible range operations.
 *
 * @param startInclusive - Starting value of the range (inclusive)
 * @param endInclusive - Ending value of the range (inclusive)
 * @returns Range object with validated boundaries
 * @throws {RangeError} When endInclusive is less than startInclusive
 *
 * @example
 * Basic range creation:
 * ```ts
 * const numberRange = $(1, 10);
 * console.log(numberRange); // { startInclusive: 1, endInclusive: 10 }
 * ```
 *
 * @example
 * Floating-point ranges:
 * ```ts
 * const floatRange = $(0.5, 9.5);
 * console.log(floatRange); // { startInclusive: 0.5, endInclusive: 9.5 }
 * ```
 *
 * @example
 * Single-value ranges:
 * ```ts
 * const singlePoint = $(5, 5);
 * console.log(singlePoint); // { startInclusive: 5, endInclusive: 5 }
 * ```
 *
 * @example
 * Error handling for invalid ranges:
 * ```ts
 * try {
 *   const invalidRange = $(10, 5); // endInclusive < startInclusive
 * } catch (error) {
 *   console.log(error.message); // "Range end must be >= start"
 * }
 * ```
 *
 * @example
 * Working with negative ranges:
 * ```ts
 * const negativeRange = $(-10, -1);
 * console.log(negativeRange); // { startInclusive: -10, endInclusive: -1 }
 * ```
 *
 * @example
 * Range validation and usage:
 * ```ts
 * function isInRange(value: number, range: ReturnType<typeof $>): boolean {
 *   return value >= range.startInclusive && value <= range.endInclusive;
 * }
 * 
 * const range = $(1, 100);
 * console.log(isInRange(50, range)); // true
 * console.log(isInRange(150, range)); // false
 * ```
 *
 * @example
 * Integer-specific ranges:
 * ```ts
 * // For integer ranges, ensure both values are integers
 * const intRange = $(Math.floor(1.2), Math.floor(10.8)); // (1, 10)
 * 
 * // Or use with integer validation
 * function createIntRange(start: number, end: number) {
 *   if (!Number.isInteger(start) || !Number.isInteger(end)) {
 *     throw new Error('Integer ranges require integer values');
 *   }
 *   return $(start, end);
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $(
  startInclusive: number,
  endInclusive: number,
): {
  readonly startInclusive: number;
  readonly endInclusive: number;
} & { __brand: 'rangeNumber' } {
  if (endInclusive < startInclusive) {
    throw new RangeError('Range end must be >= start');
  }
  
  return {
    startInclusive,
    endInclusive,
    __brand: 'rangeNumber' as const,
  };
}