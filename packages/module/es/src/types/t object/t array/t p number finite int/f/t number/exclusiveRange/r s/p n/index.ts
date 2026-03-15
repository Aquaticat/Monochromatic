import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';

/**
 * Create an integer array that strictly has values greater than startExclusive, smaller than endExclusive.
 * Useful for probing numeric string boundaries without off-by-one errors at edges.
 *
 * @returns array of branded Int values in the exclusive range
 */
export function $(
  { startExclusive, endExclusive, }: { startExclusive: number; endExclusive: number; },
): Int[] {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing floor+1 to branded Int
  const start = (Math.floor(startExclusive,) + 1) as Int;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- narrowing ceil-1 to branded Int
  const end = (Math.ceil(endExclusive,) - 1) as Int;
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- constructed array of verified integers matches Int[]
  return (start > end
    ? []
    : Array.from({ length: end - start + 1, }, function offset(_, index,) {
      return start + index;
    },)) as Int[];
}
