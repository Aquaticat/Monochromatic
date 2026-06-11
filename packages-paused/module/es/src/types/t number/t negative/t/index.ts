/**
 * Branded type for negative numbers (excludes `0`).
 */
export type $ = Exclude<number, 0> & { __brand: {
  sign: 'negative';
}; };
