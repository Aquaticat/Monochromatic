/**
 Guards class one hundred five (CuspariaKLSY9, 2026-09-23): the archive's
 gloss line of a declared name, "“Ling Shui Yu Yu Zi” means fish in clear
 water.", the Chinese silent about it, left the page for the third time on
 the judges' call although the eighty-fifth class's clause stood on every
 sheet. The line is restored after the judges, where the page is in view.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChunkPair,
  restoreNameGlossLines,
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
 The archive's gloss line.
 */
const GLOSS = '“Mittens the Cloud” means a cat like a cloud.';

/**
 Archive paragraph: the nickname sentence and its gloss on the next line.
 */
const ARCHIVE = `She got her nickname “Mittens the Cloud” while napping.\n${GLOSS}\n`;

await describe({
  name: `${restoreNameGlossLines.name} (class one hundred five)`,
  children: [
    it({
      name: 'INSERTS the archive\'s gloss line after the shipped line carrying the name, in curly or straight quotes',
      fn: async () => {
        const restored = restoreNameGlossLines({
          slices: [pair({ sliceIndex: 0, target: ARCHIVE, },), pair({ sliceIndex: 1, target: 'The sparrow "Pip" sang.\n"Pip" means a seed.\n', },),],
          replacements: [
            {
              sliceIndex: 0,
              replacementText: 'Her handle “Mittens the Cloud” was coined while she napped.\n\nShe slept on.',
            },
            {
              sliceIndex: 1,
              replacementText: 'The sparrow "Pip" was singing.',
            },
          ],
        },);
        expect(restored.replacements.map(function textOf(row,): string {
          return row.replacementText;
        },),).toEqual([
          `Her handle “Mittens the Cloud” was coined while she napped.\n${GLOSS}\n\nShe slept on.`,
          'The sparrow "Pip" was singing.\n"Pip" means a seed.',
        ],);
        expect(restored.restored.length,).toBe(2,);
        expect(restored.findings,).toEqual([
          `name-gloss-restored (slice 0: "${GLOSS}")`,
          'name-gloss-restored (slice 1: ""Pip" means a seed.")',
        ],);
      },
    },),
    it({
      name: 'LEAVES a text glossing the name its own way (a parenthesis, "means" on the line, the archive\'s line kept), '
        + 'one that never carries the name, and an archive quoting a phrase it never uses',
      fn: async () => {
        const restored = restoreNameGlossLines({
          slices: [
            pair({ sliceIndex: 0, target: ARCHIVE, },),
            pair({ sliceIndex: 1, target: ARCHIVE, },),
            pair({ sliceIndex: 2, target: ARCHIVE, },),
            pair({ sliceIndex: 3, target: ARCHIVE, },),
            pair({ sliceIndex: 4, target: 'She said hello.\n“Hello” means a greeting.\n', },),
          ],
          replacements: [
            { sliceIndex: 0, replacementText: 'Her handle, Mittens the Cloud (a cat like a cloud), was coined while she napped.', },
            { sliceIndex: 1, replacementText: 'Her handle “Mittens the Cloud” means a cat like a cloud and was coined while she napped.', },
            { sliceIndex: 2, replacementText: `She got her nickname “Mittens the Cloud” while napping.\n${GLOSS}`, },
            { sliceIndex: 3, replacementText: 'Her handle was coined while she napped.', },
            { sliceIndex: 4, replacementText: 'She said hi.', },
          ],
        },);
        expect(restored.restored,).toEqual([],);
        expect(restored.findings,).toEqual([],);
      },
    },),
  ],
},);
