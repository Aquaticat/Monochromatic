/**
 * Branded type for positive numbers (excludes `0`).
 */
export type $ = Exclude<number, 0> & { __brand: {
  sign: 'positive';
}; };
