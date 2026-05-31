import type { $ as Int, } from '@/src/types/t number/t finite/t int/t';

/**
 * Branded type for an inclusive integer range with `startInclusive` and `endInclusive` bounds.
 */
export type $ = {
  startInclusive: Int;
  endInclusive: Int;
  __brand: {
    rangeNumber: true;
    inQuotes?: Map<string, boolean>;
  };
};
