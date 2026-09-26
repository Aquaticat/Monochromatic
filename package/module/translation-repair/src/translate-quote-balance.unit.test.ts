/**
 Guards class one hundred sixty-five (TianqiChen6665, 2026-09-26): the
 archive's rendering of a three-line final message carried one closing
 quotation mark and no opening one, where the original quotes every line with
 「」, and the page shipped it unendorsed. A closing double quotation mark
 with no opening mark before it is refused where the original's own
 quotation marks close nothing they did not open.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { validateTranslatedSlice, } from '../dist/final/node/index.mjs';

/**
 Original in which the kitten says one quoted line.
 */
const QUOTED = '「小猫还想更可爱一点。」';

/**
 Original whose one quotation runs over two paragraphs.
 */
const LONG_QUOTE = '「小猫还想更可爱一点。\n\n小猫还想更可靠一点。」';

/**
 Original closing a quotation a slice before it opened.
 */
const TAIL_OF_QUOTE = '小猫还想更可靠一点。」';

await describe({
  name: 'closing quotation marks with no opening one (class one hundred sixty-five)',
  children: [
    it({
      name: 'REFUSES a closing mark with no opening mark before it',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: QUOTED,
          candidateText: 'The kitten still wants to be a little cuter.”',
        },).kind,).toBe('invalid',);
      },
    },),
    it({
      name: 'PASSES a quotation opened and closed',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: QUOTED,
          candidateText: '“The kitten still wants to be a little cuter.”',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'PASSES a quotation over two paragraphs that opens each and closes the last',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: LONG_QUOTE,
          candidateText: '“The kitten still wants to be a little cuter.\n\n“The kitten still wants to be more reliable.”',
        },).kind,).toBe('valid',);
      },
    },),
    it({
      name: 'STANDS ASIDE where the original itself closes a quotation it did not open',
      fn: async () => {
        expect(validateTranslatedSlice({
          sourceText: TAIL_OF_QUOTE,
          candidateText: 'The kitten still wants to be more reliable.”',
        },).kind,).toBe('valid',);
      },
    },),
  ],
},);
