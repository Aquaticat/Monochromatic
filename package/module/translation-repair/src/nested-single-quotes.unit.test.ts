/**
 Guards class one hundred forty-seven (XingZ6013, 2026-09-26). The butterfly
 speech quotes a law inside its own quotation, 「醒着就要活下去」 inside
 「…」, and the page shipped “… for the law that says 'to be awake is to keep
 living.' They can fly …”: the double marks curled, the inner pair straight,
 on a page every other mark of which is curly. The restoration curled a
 straight single quote only as an apostrophe, never as a quotation mark,
 while the corpus writes a nested quotation ‘…’ on every page that has one
 and never straight. A straight single pair that opens after a space or an
 opening mark and closes before a space or a closing mark is a quotation on
 one line, and on a curly page it is written curly. Cat-themed invention
 throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { restoreTypography, } from '../dist/final/node/index.mjs';

/**
 Page text whose convention is curly throughout.
 */
const CURLY_PAGE = '“The cat’s bowl,” she said.';

await describe({
  name: 'a nested quotation in straight single marks (class one hundred forty-seven)',
  children: [
    it({
      name: 'CURLS a straight single pair inside a curly double quotation on a curly page',
      fn: async () => {
        expect(restoreTypography({
          replacement: '“The cat obeyed the law that says \'a nap is never wasted.\' Then it slept.”',
          replaced: '',
          convention: CURLY_PAGE,
        },),).toBe('“The cat obeyed the law that says ‘a nap is never wasted.’ Then it slept.”',);
      },
    },),
    it({
      name: 'CURLS the pair and the apostrophes inside it together',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'She kept saying \'it\'s only a mouse\' to the kitten.',
          replaced: '',
          convention: CURLY_PAGE,
        },),).toBe('She kept saying ‘it’s only a mouse’ to the kitten.',);
      },
    },),
    it({
      name: 'LEAVES the pair straight on a page written straight, and a lone opening mark with no partner on its line',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'The law says \'a nap is never wasted.\'',
          replaced: '',
          convention: 'The cat\'s bowl.',
        },),).toBe('The law says \'a nap is never wasted.\'',);
        expect(restoreTypography({
          replacement: 'The \'90s cat\nslept.',
          replaced: '',
          convention: CURLY_PAGE,
        },),).toBe('The \'90s cat\nslept.',);
      },
    },),
    it({
      name: 'LEAVES a possessive after an emphasis span as the apostrophe it is',
      fn: async () => {
        expect(restoreTypography({
          replacement: 'The *Whiskers*\'s opening line was \'meow.\'',
          replaced: '',
          convention: CURLY_PAGE,
        },),).toBe('The *Whiskers*’s opening line was ‘meow.’',);
      },
    },),
  ],
},);
