/**
 Guards class sixty-seven (XingZ616, 2026-09-19): a contributor's name in a
 section heading was translated word for word ("Painted Capital",
 "Impermanence") while the archive renders the same person's signature as
 the handle the human translator knew ("HiYku", "Ann"), and one lane even
 rewrote the archive's handle in the signature into a transliteration
 ("Huidu"). A name the original signs with is a person; the page renders it
 one way everywhere, the archive's way when the archive carries the
 signature, else the page's own signature rendering. Cat-themed invention
 throughout; no corpus content appears here.

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
 A section the archive carries: the heading names the signer, the archive
 knows the signer's handle.
 */
const CARRIED = pair({
  sliceIndex: 0,
  source: '### 其三：猫猫\n\n它睡了。\n\n> <p style="text-align: end;">——猫猫, 2024 年 12 月 17 日</p>',
  target: '### Maomao\n\nIt sleeps.\n\n> <p style="text-align: end;">——Maomao, December 17, 2024</p>',
});

/**
 A section the archive never translated: the page's own signature rendering
 is the name.
 */
const UNCARRIED = pair({
  sliceIndex: 1,
  source: '### 其十：锦猫\n\n它醒了。\n\n<p style="text-align: end;">——锦猫, 2025 年 2 月 10 日</p>',
  target: '',
});

await describe({
  name: 'a contributor name is rendered one way across headings and signatures (class sixty-seven, XingZ616)',
  children: [
    it({
      name: 'RESTORES the archive\'s handle into a heading translated word for word and into a respelt signature',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [CARRIED,],
          replacements: [{
            sliceIndex: 0,
            replacementText: '### Three: Cat Cat\n\nIt sleeps.\n\n> <p style="text-align: end;">—Mao Mao, December 17, 2024</p>',
          },],
        },);
        expect(restored.replacements[0]?.replacementText,)
          .toBe('### Three: Maomao\n\nIt sleeps.\n\n> <p style="text-align: end;">—Maomao, December 17, 2024</p>',);
        expect(restored.restored.length,).toBe(1,);
        expect(restored.findings.length,).toBe(2,);
      },
    },),
    it({
      name: 'USES the page\'s own signature rendering where the archive never carried the section',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [UNCARRIED,],
          replacements: [{
            sliceIndex: 1,
            replacementText: '### Ten: Brocade Cat\n\nIt wakes.\n\n<p style="text-align: end;">—Jinmao, February 10, 2025</p>',
          },],
        },);
        expect(restored.replacements[0]?.replacementText,)
          .toBe('### Ten: Jinmao\n\nIt wakes.\n\n<p style="text-align: end;">—Jinmao, February 10, 2025</p>',);
      },
    },),
    it({
      name: 'LEAVES a page whose names already agree untouched',
      fn: async () => {
        const restored = restoreContributorNames({
          slices: [CARRIED,],
          replacements: [{
            sliceIndex: 0,
            replacementText: '### Three: Maomao\n\nIt dozes.\n\n> <p style="text-align: end;">——Maomao, December 17, 2024</p>',
          },],
        },);
        expect(restored.restored,).toEqual([],);
        expect(restored.findings,).toEqual([],);
      },
    },),
  ],
},);
