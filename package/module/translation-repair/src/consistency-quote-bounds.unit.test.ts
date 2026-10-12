/**
 Tests for where a quote's words begin and end: the space and invisible
 characters around them and the punctuation that closes them left out, a
 character beyond the first plane never cut in halves.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  quoteBounds,
  quoteCore,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: quoteCore.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'TAKES THE CLOSING PUNCTUATION AND SPACE OFF A QUOTE\'S END and nothing else',
          fn: async () => {
            expect({
              full: quoteCore({ quote: 'the cat naps.', },),
              many: quoteCore({ quote: 'the cat naps...!? ', },),
              wide: quoteCore({ quote: '小猫在睡觉。', },),
              inner: quoteCore({ quote: 'the cat, napping', },),
              quoted: quoteCore({ quote: 'she said "hi"', },),
              none: quoteCore({ quote: '.!', },),
            },).toEqual({
              full: 'the cat naps',
              many: 'the cat naps',
              wide: '小猫在睡觉',
              inner: 'the cat, napping',
              quoted: 'she said "hi"',
              none: '',
            },);
          },
        },),
        it({
          name: 'KEEPS A VARIATION SELECTOR WITH THE CHARACTER IT FOLLOWS, taking only the punctuation after it off a '
            + 'quote\'s end',
          fn: async () => {
            const heart = String.fromCodePoint(0x27_64, 0xFE_0F,);
            expect({
              emoji: quoteCore({ quote: `I love you ${heart}.`, },),
              astral: quoteCore({ quote: `Meow ${String.fromCodePoint(0x1_F6_3A,)}...`, },),
              astralKept: quoteCore({ quote: `Meow ${String.fromCodePoint(0x1_F6_3A,)}`, },),
            },).toEqual({
              emoji: `I love you ${heart}`,
              astral: `Meow ${String.fromCodePoint(0x1_F6_3A,)}`,
              astralKept: `Meow ${String.fromCodePoint(0x1_F6_3A,)}`,
            },);
          },
        },),
      ],
    },),

    describe({
      name: quoteBounds.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES WHERE THE WORDS BEGIN AND END IN UTF-16 UNITS, after a leading space and before the closing punctuation',
          fn: async () => {
            const cat = String.fromCodePoint(0x1_F6_3A,);
            expect([
              quoteBounds({ quote: ' the cat naps.', },),
              quoteBounds({ quote: `${cat} naps ${cat}!`, },),
              quoteBounds({ quote: '. ', },),
              quoteBounds({ quote: '', },),
            ],).toEqual([
              { start: 1, end: 13, },
              { start: 0, end: 10, },
              { start: 0, end: 0, },
              { start: 0, end: 0, },
            ],);
          },
        },),
        it({
          name: 'TAKES THE SPACE OFF A QUOTE\'S START as well as its end',
          fn: async () => {
            expect(quoteCore({ quote: '  \n the cat naps \n', },),).toBe('the cat naps',);
          },
        },),
      ],
    },),
  ],
},);
