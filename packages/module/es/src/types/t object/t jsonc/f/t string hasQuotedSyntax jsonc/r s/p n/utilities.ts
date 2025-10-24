import type { $ as Int, } from '@_/types/t number/t finite/t int/t/index.ts';
import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import * as Jsonc from '../../../../t/index.ts';

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

export function scanQuotedString(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
): { consumed: FragmentStringJsonc; parsed: Jsonc.Value;
  remaining: FragmentStringJsonc; }
{
  if (!value.startsWith('"',))
    throw new Error('expected a double quote to start a JSON string',);

  const findTerminatingQuote = (input: string, fromIndex: number,): number => {
    const quoteIndex = input.indexOf('"', fromIndex,);
    if (quoteIndex === -1)
      throw new Error('malformed jsonc, unterminated string',);

    const beforeQuote = input.slice(0, quoteIndex,);
    const backslashesMatch = beforeQuote.match(/\\+$/,);
    const backslashRunLength = backslashesMatch?.[0].length ?? 0;
    const isUnescaped = (backslashRunLength % 2) === 0;
    return isUnescaped ? quoteIndex : findTerminatingQuote(input, quoteIndex + 1,);
  };

  const closingIndex = findTerminatingQuote(value, 1,);
  const consumed = value.slice(0, closingIndex + 1,) as FragmentStringJsonc;
  const remaining = value.slice(closingIndex + 1,) as FragmentStringJsonc;
  return { consumed, parsed: { value: consumed, }, remaining, };
}
