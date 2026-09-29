/**
 Tests the footnote mention counter's refusal (ledger T8): a text carrying
 more markers than the guard counts is refused as pathological, and one at the
 cap is still counted. The marker text is invented.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  footnoteIdentifiers,
  FootnoteOverflowError,
  MAX_SLICE_IDENTIFIERS,
} from '../dist/final/node/index.mjs';

/**
 A text of `count` distinct GFM footnote references.

 @param count - markers to write

 @returns The text
 */
function markers({ count, }: { readonly count: number; },): string {
  return Array.from(
    { length: count, },
    (_unused, index,) => `nap[^${String(index,)}]`,
  ).join(' ',);
}

await describe({
  name: footnoteIdentifiers.name,
  children: [
    it({
      name: 'COUNTS A TEXT AT THE CAP, and refuses one marker more as pathological',
      fn: async () => {
        expect(footnoteIdentifiers({ text: markers({ count: MAX_SLICE_IDENTIFIERS, },), },).size,).toBe(MAX_SLICE_IDENTIFIERS,);
        expect(() => footnoteIdentifiers({ text: markers({ count: MAX_SLICE_IDENTIFIERS + 1, },), },),).toThrow(
          FootnoteOverflowError,
        );
      },
    },),
  ],
},);
