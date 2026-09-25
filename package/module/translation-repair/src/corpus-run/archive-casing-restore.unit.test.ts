/**
 Guards class one hundred twenty-one (mikaela17, 2026-09-25): the archive
 writes a romanised place name in capitals, as its translator's note says
 the city does, in the body and again in a footnote. A judge chose a
 candidate writing it title case "instead of all-caps", so the page carried
 the name one way in the body and the archive's way in the footnote. The
 archive's all-capitals form is restored after the judges, where the page is
 in view. Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  restoreArchiveCasing,
} from '../../dist/final/node/index.mjs';

/**
 One slice over an archive text.

 @param sliceIndex - where the slice stands

 @param target - archive text

 @returns Prepared pair

 @example
 ```ts
 const slice = pair({ sliceIndex: 0, target: 'She napped.', },);
 ```
 */
function pair(
  {
    sliceIndex,
    target,
  }: {
    readonly sliceIndex: number;
    readonly target: string;
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
      startOffset: 0,
      endOffset: target.length,
      text: target,
    },
  };
}

/**
 Archive slices: a station in capitals in the body and in its footnote, a
 word capitalised once for emphasis, and a word the archive writes both
 ways.
 */
const SLICES: readonly ChunkPair[] = [
  pair({
    sliceIndex: 3,
    target: '## From Maowu to the Sea',
  },),
  pair({
    sliceIndex: 0,
    target: 'We got off at MAOWU Station[^1] and it was NOT raining. NOTE the rain.',
  },),
  pair({
    sliceIndex: 1,
    target: 'A note on the rain: none fell.',
  },),
  pair({
    sliceIndex: 2,
    target: '[^1]: MAOWU Station is where the cats change lines.',
  },),
];

await describe({
  name: 'restoreArchiveCasing (class one hundred twenty-one)',
  children: [
    it({
      name: 'RESTORES the archive\'s all-capitals form of a name it writes that way more than once and never otherwise',
      fn: async () => {
        /**
         Pass over a page whose body wrote the station title case.
         */
        const restored = restoreArchiveCasing({
          slices: SLICES,
          replacements: [
            {
              sliceIndex: 3,
              replacementText: '## From Maowu to the Sea',
            },
            {
              sliceIndex: 0,
              replacementText: 'We got off at Maowu Station[^1]; it was Not raining. Note the rain.',
            },
          ],
        },);
        // A heading writes its words title case, so the archive's heading
        // neither disqualifies the capital form nor is rewritten on the page.
        expect(restored.replacements.map(function textOf(row,): string {
          return row.replacementText;
        },),).toEqual([
          '## From Maowu to the Sea',
          'We got off at MAOWU Station[^1]; it was Not raining. Note the rain.',
        ],);
        expect(restored.restored.length,).toBe(1,);
        expect(restored.findings,).toEqual(['archive-casing-restored (slice 0: "Maowu" to "MAOWU")',],);
      },
    },),
    it({
      name: 'LEAVES a lower-case form, a link destination and a word already in capitals',
      fn: async () => {
        /**
         Pass over a page whose only other forms are not title case.
         */
        const restored = restoreArchiveCasing({
          slices: SLICES,
          replacements: [
            {
              sliceIndex: 0,
              replacementText: 'We got off at [MAOWU](https://example.test/maowu) Station[^1] near maowu.',
            },
          ],
        },);
        expect(restored.replacements.map(function textOf(row,): string {
          return row.replacementText;
        },),).toEqual(['We got off at [MAOWU](https://example.test/maowu) Station[^1] near maowu.',],);
        expect(restored.restored,).toEqual([],);
        expect(restored.findings,).toEqual([],);
      },
    },),
  ],
},);
