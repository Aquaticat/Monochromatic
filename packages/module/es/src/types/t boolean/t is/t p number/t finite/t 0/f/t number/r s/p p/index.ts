/**
 * Type guard that narrows number type to literal 0.
 * 
 * Enables TypeScript to infer exact zero type in conditional branches,
 * useful for handling zero as special case distinct from other numbers.
 * 
 * @param value - Number to check for zero equality
 * @returns Type predicate indicating whether value is exactly 0
 * 
 * @example
 * ```ts
 * const num = Math.random() - 0.5;
 * if ($(num)) {
 *   // num is typed as 0
 *   console.log('Got zero');
 * }
 * ```
 */
export function $(
  value: number,
): value is 0 {
  return value === 0;
}