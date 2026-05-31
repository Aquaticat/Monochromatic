/**
 * Deterministic Mulberry32 PRNG.
 *
 * Reproducible test corpora; same seed always produces same sequence.
 * Mirrors `packages/webapp-content/messages-demo/src/lib/seed.ts`.
 */

/* oxlint-disable eslint/no-magic-numbers, unicorn/prefer-math-trunc -- Mulberry32 algorithmic constants and bitwise int coercion */
/**
 * Mulberry32 step. Cheap and good enough for content distribution.
 *
 * @param seed - integer seed; same seed yields same sequence
 *
 * @returns pseudo-random number in [0, 1)
 *
 * @example
 * ```ts
 * rng(42); // some number in [0, 1) deterministic for seed 42
 * ```
 */
export function rng(seed: number,): number {
  /**
   * Mutable accumulator coerced to int32 so subsequent bitwise math stays in range.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Mulberry32 PRNG step requires mutating int32 accumulator across the avalanche rounds
  let value = seed | 0;
  value = (value + 0x6D_2B_79_F5) | 0;
  /**
   * Mixing temporary mutated through the second avalanche step before final reduction.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Mulberry32 PRNG step requires mutating mixing temp across the second avalanche round
  let temp = Math.imul(
    value ^ (value >>> 15),
    value | 1,
  );
  temp ^= temp + Math
    .imul(
    temp ^ (temp >>> 7),
    temp | 61,
  );
  return (((temp ^ (temp >>> 14)) >>> 0) % 100_000) / 100_000;
}
/* oxlint-enable eslint/no-magic-numbers, unicorn/prefer-math-trunc */

/**
 * Returns an integer in `[lo, hi)` using {@link rng}.
 *
 * @param row - seed and bounds
 *
 * @returns integer in `[lo, hi)`
 *
 * @example
 * ```ts
 * rngInt({ seed: 1, lo: 0, hi: 10 }); // 0..9
 * ```
 */
export function rngInt(row: {
  seed: number;
  lo: number;
  hi: number;
},): number {
  if (row.hi
    <= row
    .lo)
    return row.lo;
  return row.lo
    + Math
    .floor(rng(row.seed,)
      * (row.hi
        - row
        .lo),);
}

/**
 * Picks a deterministic element from an array given a seed.
 *
 * @param row - seed and items
 *
 * @returns picked element (or undefined when items is empty)
 *
 * @example
 * ```ts
 * rngPick({ seed: 1, items: ['a', 'b'] });
 * ```
 */
export function rngPick<T,>(row: {
  seed: number;
  items: readonly T[];
},): T | undefined {
  if (row.items
    .length
    === 0)
    return undefined;
  return row.items[Math.floor(rng(row.seed,)
    * row
    .items
    .length,)];
}
