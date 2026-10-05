/**
 Tests the reading of where a fragment keeps link URLs (ledger B159): the
 span of each of the three shapes, written as offsets of the text, and the
 search that places an offset in them. Fixtures are cat-themed invention.

 @module
 */

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  insideUrlSpan,
  urlSpansOf,
} from '../dist/final/node/index.mjs';

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: urlSpansOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'SPANS AN INLINE DESTINATION AFTER ITS `](`, an angle autolink with its brackets, and a bare '
            + 'literal to the next whitespace, each as offsets of the text and none for the label or the prose',
          fn: async () => {
            const destination = 'https://cat.example/[^9]x';
            const angle = '<https://cat.example/[^8]x>';
            const literal = 'www.cat.example/[^7]x';
            const text = `A [paws [^1]](${destination}) nap ${angle} and ${literal} then [^2].`;
            expect(urlSpansOf({ text, },),).toEqual([
              { start: text.indexOf(destination,), end: text.indexOf(destination,) + destination.length, },
              { start: text.indexOf(angle,), end: text.indexOf(angle,) + angle.length, },
              { start: text.indexOf(literal,), end: text.indexOf(literal,) + literal.length, },
            ],);
          },
        },),
        it({
          name: 'SPANS NOTHING in a text with no URL, and reads a destination that closes the text',
          fn: async () => {
            expect(urlSpansOf({ text: 'A cat naps [^1].', },),).toEqual([],);
            expect(urlSpansOf({ text: '[a](https://c.example', },),).toEqual([{ start: 4, end: 21, },],);
          },
        },),
      ],
    },),

    describe({
      name: insideUrlSpan.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'PLACES AN OFFSET by the span holding it, the start in and the end out, and finds none among no spans',
          fn: async () => {
            const spans = [{ start: 2, end: 5, }, { start: 9, end: 12, }, { start: 20, end: 21, },];
            expect(
              [0, 1, 2, 4, 5, 8, 9, 11, 12, 20, 21, 30,].map(function placed(offset,): boolean {
                return insideUrlSpan({ spans, offset, },);
              },),
            ).toEqual([false, false, true, true, false, false, true, true, false, true, false, false,],);
            expect(insideUrlSpan({ spans: [], offset: 3, },),).toBe(false,);
          },
        },),
      ],
    },),
  ],
},);
