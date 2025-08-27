/**
 * Type representing positive numeric values
 * Excludes zero from both number and bigint types
 */
export type $ = Exclude<number | bigint, 0 | 0n> & { __brand: {
  sign: 'positive';
}; };
