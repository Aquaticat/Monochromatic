/**
 * Branded type for an inclusive numeric range with `startInclusive` and `endInclusive` bounds.
 */
export type $ = {
  startInclusive: number;
  endInclusive: number;
  __brand: {
    rangeNumber: true;
  };
};
