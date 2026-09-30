/**
 The section headings a title reference is unified with: which heading
 titles the pass reads, the rendering it takes from each, and a title two
 headings share. Cat-themed invention throughout; no corpus content appears
 here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type SliceReplacement,
  unifyTitleReferences,
} from '../../dist/final/node/index.mjs';
import {
  pair,
  textsOf,
} from './title-reference.test-fixture.ts';

/**
 Original credit bracketing the title the headings carry.
 */
const CREDIT = pair({
  sliceIndex: 1,
  source: '—— 云猫《猫的午后》',
  target: '',
},);

/**
 Page after the pass over two headings titled alike and the credit between
 them.

 @param first - page text of the first heading

 @param second - page text of the second heading

 @param credit - page text of the credit

 @returns Rows and findings

 @example
 ```ts
 const unified = passOverTwoHeadings({ first: '### Cat', second: '### Cat', credit: '—— Yunmao “Kitty”', },);
 ```
 */
function passOverTwoHeadings(
  {
    first,
    second,
    credit,
  }: {
    readonly first: string;
    readonly second: string;
    readonly credit: string;
  },
): ReturnType<typeof unifyTitleReferences> {
  /**
   What the page writes per slice.
   */
  const replacements: readonly SliceReplacement[] = [
    {
      sliceIndex: 0,
      replacementText: first,
    },
    {
      sliceIndex: 1,
      replacementText: credit,
    },
    {
      sliceIndex: 2,
      replacementText: second,
    },
  ];
  return unifyTitleReferences({
    slices: [
      pair({
        sliceIndex: 0,
        source: '### 猫的午后',
        target: '',
      },),
      CREDIT,
      pair({
        sliceIndex: 2,
        source: '### 猫的午后',
        target: '',
      },),
    ],
    replacements,
  },);
}

await describe({
  name: `${unifyTitleReferences.name} over the headings a reference points at`,
  children: [
    it({
      name: 'LEAVES A REFERENCE TO A TITLE TWO HEADINGS RENDER APART, since which rendering it takes cannot be read',
      fn: async () => {
        /**
         Pass over two headings rendering one title two ways.
         */
        const unified = passOverTwoHeadings({
          first: '### The Cat\u{2019}s Afternoon',
          second: '### An Afternoon with the Cat',
          credit: '—— Yunmao \u{201C}Cat Afternoon\u{201D}',
        },);
        expect(textsOf({ rows: unified.replacements, },)[1],).toBe('—— Yunmao \u{201C}Cat Afternoon\u{201D}',);
        expect(unified.findings,).toEqual([],);
      },
    },),
    it({
      name: 'UNIFIES A REFERENCE TO A TITLE TWO HEADINGS RENDER ALIKE (quality call, T8 batch 10), apostrophe style '
        + 'aside, and names both headings',
      fn: async () => {
        /**
         Pass over two headings rendering one title alike but for the apostrophe.
         */
        const unified = passOverTwoHeadings({
          first: '### The Cat\u{2019}s Afternoon',
          second: '### The Cat\'s Afternoon',
          credit: '—— Yunmao \u{201C}Cat Afternoon\u{201D}',
        },);
        expect(textsOf({ rows: unified.replacements, },)[1],).toBe('—— Yunmao \u{201C}The Cat\u{2019}s Afternoon\u{201D}',);
        expect(unified.findings,).toEqual([
          'title-reference-unified (slice 1: "Cat Afternoon" to "The Cat\u{2019}s Afternoon"; 「猫的午后」 rendered by the '
          + 'headings of slices 0, 2 as "The Cat\u{2019}s Afternoon")',
        ],);
      },
    },),
  ],
},);
