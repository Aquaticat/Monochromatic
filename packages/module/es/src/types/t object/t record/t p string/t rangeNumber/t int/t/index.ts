import type { $ as Int, } from '@/src/types/t number/t finite/t int/t';

export type $ = {
  startInclusive: Int;
  endInclusive: Int;
  __brand: {
    rangeNumber: true;
    inQuotes?: Map<string, boolean>;
  };
};
