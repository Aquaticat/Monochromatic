/**
 Tests for the one rule every count reader in the package shares (ledger
 B73): ASCII digits that a double holds exactly, and nothing `Number` would
 also read.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isWholeNumberText,
  WHOLE_NUMBER_RULE,
} from '../dist/final/node/index.mjs';

/**
 Largest whole number a double holds exactly, as digits.
 */
const LARGEST = String(Number.MAX_SAFE_INTEGER,);

await describe({
  name: isWholeNumberText.name,
  children: [
    it({
      name: 'TAKES digits, a zero, a leading zero and the largest whole number a double holds exactly',
      fn: async () => {
        expect(['0', '12', '04', LARGEST,].map(function taken(text,): boolean {
          return isWholeNumberText({ text, },);
        },),).toEqual([true, true, true, true,],);
      },
    },),
    it({
      name: 'REFUSES what `Number` would read as a number nobody wrote: empty, blank, a sign, a point, an '
        + 'exponent, a radix, a space either side, a full-width digit, and one past the exact range',
      fn: async () => {
        /**
         Texts `Number` reads, or reads as something else, that no count here is written as.
         */
        const refused = [
          '',
          ' ',
          '-1',
          '+1',
          '1.0',
          '1e3',
          '0x1F',
          '0b1',
          '0o7',
          ' 1',
          '1 ',
          '１',
          'Infinity',
          String(BigInt(Number.MAX_SAFE_INTEGER,) + 1n,),
        ];
        expect(refused.filter(function taken(text,): boolean {
          return isWholeNumberText({ text, },);
        },),).toEqual([],);
      },
    },),
    it({
      name: 'NAMES its rule with the limit spelled out, for every refusal that cites it',
      fn: async () => {
        expect(WHOLE_NUMBER_RULE,).toBe(`a whole number written in digits, at most ${LARGEST}`,);
      },
    },),
  ],
},);
