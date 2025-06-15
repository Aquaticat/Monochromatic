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
