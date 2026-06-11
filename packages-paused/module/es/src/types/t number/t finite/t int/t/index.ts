import type { $ as Finite, } from '../../t/index.ts';

/**
 * Branded type for finite integer numbers.
 */
export type $ = Finite & { __brand: {
  int: true;
}; };
