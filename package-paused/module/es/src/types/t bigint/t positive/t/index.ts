/**
 * Branded type for positive bigint values (excludes `0n`).
 */
export type $ = Exclude<bigint, 0n> & { __brand: {
  sign: 'positive';
}; };
