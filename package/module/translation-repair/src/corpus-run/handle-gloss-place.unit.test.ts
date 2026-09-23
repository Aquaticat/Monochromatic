/**
 Guards class eighty-eight (XingZ624, 2026-09-23): the house rule puts a
 romanised handle's literal meaning in parentheses at its first appearance
 on the page and the romanisation alone after that, but every slice is
 written on its own, so the page carried the bare handle in the section
 heading and the gloss on the signature below it, and one song credit bare
 with the gloss on the next. The page decides once, here, where every
 appearance is in view: the first appearance carries the gloss the bench
 wrote anywhere, the later ones drop it. Cat-themed invention throughout; no
 corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  placeHandleGlosses,
} from '../../dist/final/node/index.mjs';

/**
 One slice with an original and an archive text.

 @param sliceIndex - where the slice stands

 @param source - original text

 @param target - archive text, empty where the archive has none

 @returns Prepared pair

 @example
 ```ts
 const slice = pair({ sliceIndex: 0, source: '### 猫猫', target: '### Maomao', },);
 ```
 */
function pair(
  {
    sliceIndex,
    source,
    target,
  }: {
    readonly sliceIndex: number;
    readonly source: string;
    readonly target: string;
  },
): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: source.length,
      text: source,
    },
    target: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: target.length,
      text: target,
    },
  };
}

/**
 A section the archive never translated, headed and signed by one handle.
 */
const HEADED = pair({
  sliceIndex: 0,
  source: '### 其十：锦猫\n\n它醒了。\n\n<p style="text-align: end;">——锦猫, 2025 年 2 月 10 日</p>',
  target: '',
},);

/**
 Two song credits the archive never translated, signed by a handle no
 heading names.
 */
const CREDITED: readonly ChunkPair[] = [
  pair({
    sliceIndex: 1,
    source: '> 歌词一\n\n<p style="text-align: end;">—— 雨猫 【妄想】《歌一》</p>',
    target: '',
  },),
  pair({
    sliceIndex: 2,
    source: '> 歌词二\n\n<p style="text-align: end;">—— 雨猫 【妄想】《歌二》</p>',
    target: '',
  },),
];

/**
 A section the archive carries, whose signer the archive knows.
 */
const CARRIED = pair({
  sliceIndex: 3,
  source: '### 其三：猫猫\n\n它睡了。\n\n<p style="text-align: end;">——猫猫, 2024 年 12 月 17 日</p>',
  target: '### Maomao\n\nIt sleeps.\n\n<p style="text-align: end;">——Maomao, December 17, 2024</p>',
},);

/**
 Replacement text per slice index of a result.

 @param replacements - what the page would write

 @returns Text by slice index

 @example
 ```ts
 const text = bySlice({ replacements, },);
 ```
 */
function bySlice(
  { replacements, }: {
    readonly replacements: readonly {
      readonly sliceIndex: number;
      readonly replacementText: string;
    }[];
  },
): ReadonlyMap<number, string> {
  return new Map(replacements.map(function toEntry(replacement,): readonly [
    number,
    string,
  ] {
    return [
      replacement.sliceIndex,
      replacement.replacementText,
    ];
  },),);
}

await describe({
  name: 'a romanised handle carries its literal meaning at its first appearance alone (class eighty-eight, XingZ624)',
  children: [
    it({
      name: 'MOVES the gloss to the first appearance: the heading takes the signature\'s gloss, the signature '
        + 'drops it; the first song credit takes the second\'s gloss, the second drops it',
      fn: async () => {
        const placed = placeHandleGlosses({
          slices: [
            HEADED,
            ...CREDITED,
          ],
          replacements: [
            {
              sliceIndex: 0,
              replacementText: '### Ten: Jinmao\n\nIt woke.\n\n'
                + '<p style="text-align: end;">——Jinmao (Brocade Cat), February 10, 2025</p>',
            },
            {
              sliceIndex: 1,
              replacementText: '> Lyrics one\n\n<p style="text-align: end;">—— Yumao [Delusion] “Song One”</p>',
            },
            {
              sliceIndex: 2,
              replacementText: '> Lyrics two\n\n'
                + '<p style="text-align: end;">—— Yumao (Rain Cat) [Delusion] “Song Two”</p>',
            },
          ],
        },);
        /**
         Page text per slice after the pass.
         */
        const text = bySlice({ replacements: placed.replacements, },);
        expect(text.get(0,),).toBe(
          '### Ten: Jinmao (Brocade Cat)\n\nIt woke.\n\n'
            + '<p style="text-align: end;">——Jinmao, February 10, 2025</p>',
        );
        expect(text.get(1,),).toBe(
          '> Lyrics one\n\n<p style="text-align: end;">—— Yumao (Rain Cat) [Delusion] “Song One”</p>',
        );
        expect(text.get(2,),).toBe(
          '> Lyrics two\n\n<p style="text-align: end;">—— Yumao [Delusion] “Song Two”</p>',
        );
        expect(placed.findings.length,).toBe(4,);
        expect(placed.findings[0],).toContain('handle-gloss-placed (slice 0:',);
      },
    },),
    it({
      name: 'LEAVES a page whose gloss already stands at the first appearance alone, and one the bench never '
        + 'glossed',
      fn: async () => {
        const glossed = placeHandleGlosses({
          slices: [HEADED,],
          replacements: [{
            sliceIndex: 0,
            replacementText: '### Ten: Jinmao (Brocade Cat)\n\nIt woke.\n\n'
              + '<p style="text-align: end;">——Jinmao, February 10, 2025</p>',
          },],
        },);
        expect(glossed.findings,).toEqual([],);
        expect(glossed.restored,).toEqual([],);
        const bare = placeHandleGlosses({
          slices: [HEADED,],
          replacements: [{
            sliceIndex: 0,
            replacementText: '### Ten: Jinmao\n\nIt woke.\n\n'
              + '<p style="text-align: end;">——Jinmao, February 10, 2025</p>',
          },],
        },);
        expect(bare.findings,).toEqual([],);
        expect(bare.restored,).toEqual([],);
      },
    },),
    it({
      name: 'LEAVES a signer the archive renders alone: the house rule glosses handles the archive never '
        + 'rendered, and a rendering inside a longer word is no appearance',
      fn: async () => {
        const placed = placeHandleGlosses({
          slices: [CARRIED,],
          replacements: [{
            sliceIndex: 3,
            replacementText: '### Maomao\n\nMaomaos sleep.\n\n'
              + '<p style="text-align: end;">——Maomao (Cat Cat), December 17, 2024</p>',
          },],
        },);
        expect(placed.findings,).toEqual([],);
        expect(placed.restored,).toEqual([],);
      },
    },),
  ],
},);
