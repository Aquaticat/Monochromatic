import type {$ as Finite} from '@_/types/t number/t finite/t/index.ts';
import type { $ as Float, } from '@/src/types/t number/t finite/t float/t/index.ts';

/**
 * Type guard that narrows finite numbers to floating-point values.
 * 
 * Determines whether a finite number contains a fractional component,
 * distinguishing floats from integers within the finite number domain.
 * 
 * @param value - Finite number to check for floating-point representation
 * @returns Type predicate indicating whether value has fractional component
 * 
 * @example
 * ```ts
 * import { types } from '@monochromatic-dev/module-es';
 * 
 * const $ = types.boolean.is.p.number.finite.float.f.number.finite.r.s.p.p.$;
 * 
 * const value: number = 3.14;
 * if ($(value)) {
 *   // value is narrowed to Float type
 *   console.log('Floating-point number');
 * }
 * 
 * $(3.14); // true
 * $(42);   // false
 * ```
 */
export function $(
  value: Finite,
): value is Float {
  return !Number.isInteger(value,);
}