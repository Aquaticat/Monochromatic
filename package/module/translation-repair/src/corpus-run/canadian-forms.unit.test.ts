/**
 Guards class one hundred thirty-four (hulicaijia19, 2026-09-25): the page is
 Canadian English (class one hundred thirty-two), yet it carried "On 4 May"
 and "29th April" beside "March 13", and "liquorice" where Canadian writes
 "licorice", because the archive's day-first dates and British spellings
 stood on slices no lane rewrote. The page-assembly pass writes every date
 month first and respells a closed list of words, on every slice, outside
 markup, links, code, comments and the sealed English original.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  canadianizePage,
  canadianizeText,
  type ChunkPair,
} from '../../dist/final/node/index.mjs';

/**
 One slice over an archive text, starting at an offset.

 @param sliceIndex - where the slice stands

 @param target - archive text

 @param startOffset - where the archive text starts in the page

 @returns Prepared pair

 @example
 ```ts
 const slice = pair({ sliceIndex: 0, target: 'She napped.', startOffset: 0, },);
 ```
 */
function pair(
  {
    sliceIndex,
    target,
    startOffset,
  }: {
    readonly sliceIndex: number;
    readonly target: string;
    readonly startOffset: number;
  },
): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 4,
      text: '她打盹。',
    },
    target: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset,
      endOffset: startOffset + target.length,
      text: target,
    },
  };
}

/**
 Rewrites one text and returns only the text.

 @param text - text to rewrite

 @returns Rewritten text

 @example
 ```ts
 rewritten({ text: 'On 4 May the cat napped.', },); // 'On May 4 the cat napped.'
 ```
 */
function rewritten(
  { text, }: { readonly text: string; },
): string {
  return canadianizeText({ text, },).text;
}

await describe({
  name: 'canadianizeText and canadianizePage (class one hundred thirty-four)',
  children: [
    it({
      name: 'WRITES day-first dates month first, with a comma before a year',
      fn: async () => {
        expect([
          rewritten({ text: 'On 4th May, the cat napped.', },),
          rewritten({ text: '29th April was the cat\'s birthday.', },),
          rewritten({ text: 'The cat was born on 13 March 2024 in a box.', },),
        ],).toEqual([
          'On May 4, the cat napped.',
          'April 29 was the cat\'s birthday.',
          'The cat was born on March 13, 2024 in a box.',
        ],);
      },
    },),
    it({
      name: 'LEAVES month-first dates, numbers that are no day, words that only look like months, and a range',
      fn: async () => {
        /**
         Texts that must come back unchanged.
         */
        const unchanged = [
          'On March 13 the cat napped.',
          'The cat ate 40 May beetles.',
          'The cat may 4 times a day nap.',
          'The cat napped on 32 March, which is no date.',
          'From 1st to 3rd June the cat slept.',
        ];
        expect(unchanged.map(function rewrite(text,): string {
          return rewritten({ text, },);
        },),).toEqual([
          'On March 13 the cat napped.',
          'The cat ate 40 May beetles.',
          'The cat may 4 times a day nap.',
          'The cat napped on 32 March, which is no date.',
          'From 1st to 3rd June the cat slept.',
        ],);
      },
    },),
    it({
      name: 'RESPELLS the closed word list in lower case and leaves capitalised names',
      fn: async () => {
        expect([
          rewritten({ text: 'The cat licked compound liquorice tablets.', },),
          rewritten({ text: 'Her favorite color was gray; she realised it at the center.', },),
          rewritten({ text: 'The cat visited the Lincoln Center and Mr. Gray.', },),
        ],).toEqual([
          'The cat licked compound licorice tablets.',
          'Her favourite colour was grey; she realized it at the centre.',
          'The cat visited the Lincoln Center and Mr. Gray.',
        ],);
      },
    },),
    it({
      name: 'LEAVES markup, links, code, comments and emphasis untouched',
      fn: async () => {
        /**
         Text whose every rewritable word sits where the page's form is not prose.
         */
        const text = [
          '<p style="text-align: center;">(The cat on 4 May)</p>',
          '[a favorite](https://example.com/color/4-May) and `color` and *The Color of Cats*',
          '<!-- 4 May: gray -->',
        ].join('\n',);
        expect(rewritten({ text, },),).toEqual([
          '<p style="text-align: center;">(The cat on May 4)</p>',
          '[a favourite](https://example.com/color/4-May) and `color` and *The Color of Cats*',
          '<!-- 4 May: gray -->',
        ].join('\n',),);
      },
    },),
    it({
      name: 'REWRITES a slice no lane replaced, and leaves a slice inside the sealed English original',
      fn: async () => {
        /**
         Three archive slices: one untouched, one replaced, one sealed.
         */
        const slices = [
          pair({ sliceIndex: 0, target: '29th April was the cat\'s birthday.', startOffset: 0, },),
          pair({ sliceIndex: 1, target: 'The cat napped.', startOffset: 40, },),
          pair({ sliceIndex: 2, target: 'On 4 May the cat wrote this in English.', startOffset: 80, },),
        ];
        /**
         Pass over the page with slice 1 replaced and slice 2 sealed.
         */
        const page = canadianizePage({
          slices,
          replacements: [{ sliceIndex: 1, replacementText: 'On 4 May the cat napped in the liquorice.', },],
          archiveOriginalSpans: [{ startOffset: 80, endOffset: 200, note: 'The cat wrote this in English.', },],
        },);
        expect({
          rows: page.replacements.map(function textOf(row,): string {
            return `${String(row.sliceIndex,)}: ${row.replacementText}`;
          },)
            .toSorted(),
          restored: page.restored.map(function indexOf(row,): number {
            return row.sliceIndex;
          },)
            .toSorted(function ascending(left, right,): number {
              return left - right;
            },),
        },).toEqual({
          rows: [
            '0: April 29 was the cat\'s birthday.',
            '1: On May 4 the cat napped in the licorice.',
          ],
          restored: [0, 1,],
        },);
      },
    },),
  ],
},);
