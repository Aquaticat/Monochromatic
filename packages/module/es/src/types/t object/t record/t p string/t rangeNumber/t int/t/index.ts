import type { $ as Int, } from '@_/types/t number/t int/t/index.ts';

export type $ = {
  startInclusive: Int;
  endInclusive: Int;
  __brand: {
    rangeNumber: true;
    inQuotes?: Map<string, boolean>;
  };
};
