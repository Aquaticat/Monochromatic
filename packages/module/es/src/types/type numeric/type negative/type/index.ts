/**
 * Type representing negative numeric values
 * Applies to both number and bigint types
 */
export type $ = Exclude<number | bigint, 0 | 0n> & { __brand: {
  sign: 'negative';
}; };
