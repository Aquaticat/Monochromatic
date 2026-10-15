/**
 Tests for the stretches of images, table rows and inline code content that a parse of an English holds
 (`consistency-markup-ranges.ts`, read through `proseViewOf`).

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { proseViewOf, } from '../dist/final/node/index.mjs';

/**
 The text of each stretch.

 @param english - the English the stretches were read from
 @param ranges - the stretches
 @returns What each stretch covers, sorted, since the order of the stretches is not promised

 @example
 ```ts
 const texts = coveredBy({ english: 'a ![pic](u) b', ranges: [{ start: 2, end: 11, },], },); // ['![pic](u)']
 ```
 */
function coveredBy(
  { english, ranges, }: { readonly english: string; readonly ranges: readonly { readonly start: number; readonly end: number; }[]; },
): readonly string[] {
  return ranges
    .map(function textOf({ start, end, },): string {
      return english.slice(
        start,
        end,
      );
    },)
    .toSorted();
}

await describe({
  name: 'the markup ranges of a prose view',
  concurrency: 1,
  children: [
    it({
      name: 'COVERS an image and an image reference, each from its bang to its closing bracket or parenthesis',
      fn: async () => {
        /**
         A page with a link-destination image and a reference image.
         */
        const english = 'cats ![pic](u) dogs ![again][r] fish\n\n[r]: https://cats.example/r.png';
        expect(coveredBy({
          english,
          ranges: proseViewOf({ english, },).images,
        },),).toEqual(['![again][r]', '![pic](u)',],);
      },
    },),

    it({
      name: 'COVERS each row of a table from its first pipe to its last, the delimiter row left out',
      fn: async () => {
        /**
         A table of two rows under its header.
         */
        const english = '| cats | dogs |\n| --- | --- |\n| fish | birds |';
        expect(coveredBy({
          english,
          ranges: proseViewOf({ english, },).tableRows,
        },),).toEqual(['| cats | dogs |', '| fish | birds |',],);
      },
    },),

    it({
      name: 'COVERS the content of inline code without the backticks that open and close it, however many',
      fn: async () => {
        /**
         One single-backtick code and one double-backtick code that holds a backtick.
         */
        const english = 'The `kit` and ``a`b`` ate.';
        expect(coveredBy({
          english,
          ranges: proseViewOf({ english, },).codeContents,
        },),).toEqual(['a`b', 'kit',],);
      },
    },),

    it({
      name: 'HOLDS no stretch of any kind for an English the page grammar refuses, and for one without the markup',
      fn: async () => {
        /**
         English with none of the three kinds of markup.
         */
        const plain = proseViewOf({ english: 'The cat naps.', },);
        expect(plain.images,).toEqual([],);
        expect(plain.tableRows,).toEqual([],);
        expect(plain.codeContents,).toEqual([],);
        /**
         English the grammar refuses: a container nested past the bound.
         */
        const refused = proseViewOf({ english: `${'> '.repeat(300,)}![pic](u) \`kit\``, },);
        expect(refused.refused,).toBe(true,);
        expect(refused.images,).toEqual([],);
        expect(refused.tableRows,).toEqual([],);
        expect(refused.codeContents,).toEqual([],);
      },
    },),
  ],
},);
