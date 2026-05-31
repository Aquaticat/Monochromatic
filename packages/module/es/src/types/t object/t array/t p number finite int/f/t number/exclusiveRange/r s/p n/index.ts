import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';

/**
 * Create an integer array that strictly has values greater than startExclusive, smaller than endExclusive.
 * Useful for probing numeric string boundaries without off-by-one errors at edges.
 *
 * @returns array of branded Int values in the exclusive range
 *
 * @example
 * ```ts
 * $({ startExclusive: 0, endExclusive: 4 }); // [1, 2, 3]
 * $({ startExclusive: 5, endExclusive: 5 }); // []
 * ```
 */
export function $(
  {
    startExclusive,
    endExclusive,
  }: {
    startExclusive: number;
    endExclusive: number;
  },
): Int[] {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- narrowing floor+1 to branded Int */
  /**
   * First integer strictly greater than the exclusive lower bound.
   */
  const start = (Math.floor(startExclusive,)
    + 1) as Int;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /* oxlint-disable typescript/no-unsafe-type-assertion -- narrowing ceil-1 to branded Int */
  /**
   * Last integer strictly less than the exclusive upper bound.
   */
  const end = (Math.ceil(endExclusive,)
    - 1) as Int;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- constructed array of verified integers matches Int[]
  return (start > end
    ? []
    : Array.from(
      { length: (end - start) + 1, },
      function offset(
        _,
        index,
      ) {
        return start + index;
      },
    )) as Int[];
}
