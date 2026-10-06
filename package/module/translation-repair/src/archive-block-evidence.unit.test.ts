/**
 Tests the evidence an archive block's source quote must carry: a quote is an
 anchor only when it holds the minimum number of characters a reader sees and
 stands in the section it is claimed for.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { isArchiveSourceQuoteAnchored, } from '../dist/final/node/index.mjs';

await describe({
  name: isArchiveSourceQuoteAnchored.name,
  children: [
    it({
      name: 'COUNTS ONLY THE CHARACTERS A READER SEES toward the minimum, so a quote of two ideographs among '
        + 'zero-width spaces or Hangul fillers anchors nothing though the section holds it whole',
      fn: async () => {
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫\u{200B}在\u{200B}窗边。',
          sourceQuote: '猫\u{200B}在\u{200B}',
        },),).toBe(false,);
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫\u{3164}在\u{3164}窗边。',
          sourceQuote: '猫\u{3164}在\u{3164}',
        },),).toBe(false,);
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: '猫\u{200B}在\u{200B}窗边。',
          sourceQuote: '猫\u{200B}在\u{200B}窗边',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'COUNTS NO SPACE toward the minimum either, since a space shows a reader nothing',
      fn: async () => {
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: 'Tabby naps a b c d.',
          sourceQuote: 'a b c',
        },),).toBe(false,);
        expect(isArchiveSourceQuoteAnchored({
          sourceContext: 'Tabby naps a b c d.',
          sourceQuote: 'a b c d',
        },),).toBe(true,);
      },
    },),
  ],
},);
