/**
 Tests the footnote mention reader (ledger T8 and B35): each mention with its
 role, convention and folded identifier as fields, the counts keyed from
 them, and the refusal of a text carrying more markers than the guard counts,
 while one at the cap is still counted. The marker text is invented.

 @module
 */

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  footnoteIdentifiers,
  footnoteMentions,
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

/**
 A passage citing one note twice in GFM, once with a capital, and once in
 the full-width convention, then defining both; a GFM marker followed by its
 separator in the middle of a line stays a reference.
 */
const PASSAGE = [
  '猫打盹[^Nap]，又打盹[^nap]。见〔１〕，参见[^nap]: 不是定义。',
  '',
  '[^nap]: 午睡。',
  '〔1〕：注。',
].join('\n',);

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: footnoteMentions.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'LISTS EACH MENTION WITH ITS ROLE, CONVENTION AND IDENTIFIER folded to the parser\'s spelling, the GFM '
            + 'convention\'s first, and reads a marker as a definition only where it opens its line before its separator',
          fn: async () => {
            expect(footnoteMentions({ text: PASSAGE, },),).toEqual([
              {
                role: 'reference',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'reference',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'reference',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'definition',
                convention: 'gfm',
                identifier: 'nap',
              },
              {
                role: 'reference',
                convention: 'fullwidth-bracket',
                identifier: '1',
              },
              {
                role: 'definition',
                convention: 'fullwidth-bracket',
                identifier: '1',
              },
            ],);
          },
        },),
        it({
          name: 'REFUSES A TEXT OVER THE CAP, naming the count and the convention',
          fn: async () => {
            /**
             What the reader threw over one marker too many.
             */
            const refusal = caught(function overCap(): void {
              footnoteMentions({ text: markers({ count: MAX_SLICE_IDENTIFIERS + 1, },), },);
            },);
            expect(refusal,).toBeInstanceOf(FootnoteOverflowError,);
            expect(refusal,).toHaveProperty(
              'message',
              `${String(MAX_SLICE_IDENTIFIERS + 1,)} gfm footnote markers in one text, over the ${
            String(MAX_SLICE_IDENTIFIERS,)
          } this guard counts`,
            );
          },
        },),
      ],
    },),

    describe({
      name: footnoteIdentifiers.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'COUNTS THE MENTIONS keyed as role, convention and identifier',
          fn: async () => {
            expect([...footnoteIdentifiers({ text: PASSAGE, },).entries(),],).toEqual([
              ['reference gfm nap', 3,],
              ['definition gfm nap', 1,],
              ['reference fullwidth-bracket 1', 1,],
              ['definition fullwidth-bracket 1', 1,],
            ],);
          },
        },),
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
    },),
  ],
},);
