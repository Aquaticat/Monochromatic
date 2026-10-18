/**
 Tests for the closing joints of an English with links in it (`consistency-closing-links.ts`, n169): the offsets at which a run of
 closing marks ends in an apostrophe that a letter or a digit follows, read over the text a reader sees where the parse holds a link
 that shows nothing or only closing marks, and the reading of the text alone where no link is given.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  closingJointsOf,
  emphasisDelimitersOf,
  foldedLinksOf,
  foldWithOffsets,
  NO_FOLDED_LINKS,
} from '../dist/final/node/index.mjs';

/**
 Whether the closing joints of an English, read with the links the fold holds, include an offset.

 @param english - the English, which folds unit for unit

 @param at - the offset asked about

 @returns Whether a stand ending at the offset lies inside a word made with an apostrophe after closing marks

 @example
 ```ts
 const inside = jointAt({ english: 'kit[\\]](u)\'kit', at: 3, },); // true
 ```
 */
function jointAt(
  {
    english,
    at,
  }: {
    readonly english: string;
    readonly at: number;
  },
): boolean {
  /**
   The English in the fold.
   */
  const folded = foldWithOffsets({ text: english, },);
  return closingJointsOf({
    folded: folded.folded,
    originals: folded.originals,
    closing: emphasisDelimitersOf({ english, },).closing,
    links: foldedLinksOf({
      english,
      folded,
    },),
  },)
    .has(at,);
}

await describe({
  name: closingJointsOf.name,
  concurrency: 1,
  children: [
    it({
      name: 'CROSSES A LINK THAT SHOWS NOTHING OR ONLY CLOSING MARKS, so the joint at the offset where the link starts is the joint of '
        + 'the text a reader sees there, whatever the link writes in its destination, and the run of links is one pass (n169)',
      fn: async () => {
        /**
         Each English with a link, the offset a stand of `kit` ends at, and the text a reader sees of it.
         */
        const rows: readonly (readonly [string, number, string])[] = [
          [String.raw`kit[\]](u)'kit`, 3, 'kit]\'kit',],
          ['kit[”](u)\'kit', 3, 'kit”\'kit',],
          ['kit[))](u)\'kit', 3, 'kit))\'kit',],
          ['kit[](u)]\'kit', 3, 'kit]\'kit',],
          ['kit[](u)[](v)]\'kit', 3, 'kit]\'kit',],
          [String.raw`kit[](u)[\]](v)'kit`, 3, 'kit]\'kit',],
          [String.raw`kit[\]](u)[](v)'kit`, 3, 'kit]\'kit',],
          ['"kit"[](u)\'s', 4, '"kit"\'s',],
          ['**kit**[](u)\'s', 7, '**kit**\'s',],
          ['(kit)[](u)\'s', 4, '(kit)\'s',],
          ['kit[](u)\'kit', 3, 'kit\'kit',],
          ['kit[-](u)\'kit', 3, 'kit-\'kit',],
          ['kit[x](u)\'kit', 3, 'kitx\'kit',],
          ['kit[()](u)\'kit', 3, 'kit()\'kit',],
          ['kit[](u)', 3, 'kit',],
        ];
        expect(rows.map(function linkedJointOf([english, at,],): boolean {
          return jointAt({
            english,
            at,
          },);
        },),).toEqual(rows.map(function twinJointOf([, at, twin,],): boolean {
          return jointAt({
            english: twin,
            at,
          },);
        },),);
        expect(rows.map(function twinJointOf([, at, twin,],): boolean {
          return jointAt({
            english: twin,
            at,
          },);
        },),).toEqual([true, true, true, true, true, true, true, true, true, true, false, false, false, false, false,],);
        expect(jointAt({ english: `kit${'[](u)'.repeat(2_000,)}]'kit`, at: 3, },),).toBe(true,);
        expect(jointAt({ english: `kit${'[](u)'.repeat(2_000,)}'kit`, at: 3, },),).toBe(false,);
      },
    },),

    it({
      name: 'ALSO NAMES THE OFFSET AFTER A LINK THAT SHOWS NOTHING when a closing mark stands before it, since a stand that ends in the '
        + 'closing mark ends at the link as it ends at the apostrophe in the text a reader sees (n169)',
      fn: async () => {
        expect([
          jointAt({ english: '"kit"[](u)\'s', at: 5, },),
          jointAt({ english: '"kit"\'s', at: 5, },),
          jointAt({ english: '"kit"[](u)[](v)\'s', at: 5, },),
          jointAt({ english: '"kit"[](u)[](v)\'s', at: 10, },),
        ],).toEqual([true, true, true, true,],);
      },
    },),

    it({
      name: 'READS THE TEXT ALONE where no link is given or the parse holds none that shows nothing or only closing marks',
      fn: async () => {
        /**
         The English, which holds a link that shows a word.
         */
        const english = 'Fill [the cat](x)\'s bowl.';
        /**
         The English in the fold.
         */
        const folded = foldWithOffsets({ text: english, },);
        /**
         The joints with the links the parse holds, and with none given.
         */
        const [withLinks, withNone,] = [
          foldedLinksOf({
            english,
            folded,
          },),
          NO_FOLDED_LINKS,
        ].map(function jointsWith(links,): ReadonlySet<number> {
          return closingJointsOf({
            folded: folded.folded,
            originals: folded.originals,
            closing: new Set(),
            links,
          },);
        },);
        expect([...(withLinks ?? []),],).toEqual([...(withNone ?? []),],);
        expect(withNone?.has(13,),).toBe(true,);
        expect(closingJointsOf({ folded: english, originals: Array.from(english,), closing: new Set(), },).has(13,),).toBe(true,);
      },
    },),
  ],
},);
