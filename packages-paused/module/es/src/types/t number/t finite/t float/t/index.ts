import type { $ as Finite, } from '../../t/index.ts';

/**
 * Branded type for finite floating-point numbers (non-integer finite numbers).
 */
export type $ = Finite & { __brand: {
  int: false;
}; };
