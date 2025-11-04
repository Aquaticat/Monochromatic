import type { $ as Finite, } from '@_/types/t number/t finite/t/index.ts';
import type {$ as Int} from '@_/types/t number/t finite/t int/t/index.ts';

/**
 * Type guard that narrows finite numbers to integers.
 * 
 * Useful for distinguishing whole numbers from decimal values in type-safe operations
 * where integer-specific behavior is required.
 * 
 * @param value - Finite number to check
 * @returns Type predicate indicating whether value is an integer
 * 
 * @example
 * ```ts
 * const num: Finite = 42.5;
 * if ($(num)) {
 *   // num is Int here
 *   console.log('Integer:', num);
 * }
 * ```
 */
export function $(
  value: Finite,
): value is Int {
  return Number.isInteger(value,);
}