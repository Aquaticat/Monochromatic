/**
 Guards class one hundred thirty-eight (XingZ6011, 2026-09-26): the
 original credited a song with 「——来自《[title](url)》[^9]，作者 handle」,
 and the signature reader, which ends a name at 《, took 来自 ("from") for
 the signer. With no archive rendering, its pinyin reading stood as the
 authority and the restore replaced the page's whole credit, link and
 footnote marker included, with that reading; the orphaned definition then
 cost the page a destination. A credit's lead word names no one. Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  restoreContributorNames,
} from '../../dist/final/node/index.mjs';

/**
 One slice the archive does not carry.

 @param source - original text

 @returns Prepared pair with an empty archive text

 @example
 ```ts
 const slice = unarchived({ source: '——猫猫，2024 年', },);
 ```
 */
function unarchived({ source, }: { readonly source: string; },): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: source.length,
      text: source,
    },
    target: {
      kind: 'content',
      sliceIndex: 0,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '',
    },
  };
}

await describe({
  name: 'restoreContributorNames on source credits (class one hundred thirty-eight)',
  children: [
    it({
      name: 'LEAVES a credit whose lead word is 来自, with its link and marker',
      fn: async () => {
        /**
         The page's credit line.
         */
        const page = '<p style="text-align: end;">——From “Yarn Ball” ([毛线球](https://example.com/yarn))[^1], by Maomao Official</p>';
        /**
         What the restore makes of it.
         */
        const restored = restoreContributorNames({
          slices: [unarchived({ source: '<p style="text-align: end;">——来自《[毛线球](https://example.com/yarn)》[^1]，作者 猫猫Official</p>', },),],
          replacements: [{
            sliceIndex: 0,
            replacementText: page,
          },],
        },);
        expect(restored.findings,).toEqual([],);
        expect(restored.replacements[0]?.replacementText,).toBe(page,);
      },
    },),
  ],
},);
