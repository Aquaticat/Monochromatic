/**
 * Throws the provided value, enabling error throwing within expressions.
 *
 * Designed for use with the nullish coalescing operator to throw when a value is nullish,
 * allowing functional-style error handling without breaking expression chains.
 *
 * This utility serves as a stopgap until the TC39 throw expressions proposal
 * (https://tc39.es/proposal-throw-expressions/) becomes available in JavaScript,
 * which will enable native `throw` in expression contexts.
 *
 * @param value - Value to throw as an error
 * @returns Never returns (always throws)
 * @throws The provided value
 *
 * @example
 * ```ts
 * // Throw if getValue() returns null or undefined
 * const result = getValue() ?? $({ value: new Error('Value is required') });
 *
 * // Use in parameter validation
 * function process(data: Data | null) {
 *   const validData = data ?? $({ value: new Error('Data cannot be null') });
 *   // ... continue with validData
 * }
 * ```
 */
export function $({ value, }: { value: unknown; },): void {
  throw value;
}
