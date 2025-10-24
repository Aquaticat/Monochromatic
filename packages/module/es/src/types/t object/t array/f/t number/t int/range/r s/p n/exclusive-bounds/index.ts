import type { $ as Int } from '@_/types/t number/t finite/t int/t/index.ts';

/**
 * Create an integer array that strictly has values greater than startExclusive, smaller than endExclusive.
 * Useful for probing numeric string boundaries without off-by-one errors at edges.
 */
export function $({ startExclusive, endExclusive }: { startExclusive: number; endExclusive: number }): Int[] {
  const start = (Math.floor(startExclusive) + 1) as Int;
  const end = (Math.ceil(endExclusive) - 1) as Int;
  return (start > end
    ? []
    : Array.from({ length: end - start + 1 }, (_, index) => start + index)) as Int[];
}
