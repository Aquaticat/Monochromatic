import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';

export const numberLengthsToTestFirst = [1, 2, 4, 8, 16,] as const;

export function getLengthsToTestFirst(
  { lengthUpperBound, lengths, }: { lengthUpperBound: number;
    lengths: readonly number[]; },
): number[] {
  const result = [lengthUpperBound,];
  for (const length of lengths) {
    if (length > lengthUpperBound)
      break;

    result.push(length,);
  }
  return result;
}

// TODO: Find a better home for this fn.
export function getArrayInts(
  { startExclusive, endExclusive, }: { startExclusive: number; endExclusive: number; },
): Int[] {
  const start = (Math.floor(startExclusive,) + 1) as Int;
  const end = (Math.ceil(endExclusive,) - 1) as Int;
  const result = (start > end
    ? []
    : Array.from({ length: end - start + 1, }, (_, index,) => start + index,)) as Int[];
  return result;
}

//region numbers in js
const _num2 = 0.0e0;
const _num3 = 0.e0;
const _num4 = 0e0;
const _num8 = 0e01;

// invalid
// const _num5 = e0;
// const _num8 = -e0;
// invalid (by eslint)
// const _num6 = 01;

//endregion numbers in js
