/**
 Guards class one hundred seventy-three (TianqiChen6668, 2026-09-26): the
 archive sets an anime's title in italics, yet the page wrote the same words
 in curly quotes, broken across two lines after the colon, so the page named
 a work in a form the archive never used. The page-assembly pass reads the
 archive's italic spans and, where the page quotes the same words in prose,
 restores the italic form, moving a period or comma the quotes held outside.

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
  restoreArchiveItalicTitles,
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
 Text the page carries at slice 1 after the pass, where slice 0 is an
 archive paragraph no lane replaced and a lane wrote slice 1.

 @param archive - archive text of slice 0

 @param replacement - what a lane wrote for slice 1

 @returns Slice 1's text after the pass

 @example
 ```ts
 secondSlice({ archive: 'She loved *Long Nap*.', replacement: 'She loved “Long Nap”.', },);
 ```
 */
function secondSlice(
  {
    archive,
    replacement,
  }: {
    readonly archive: string;
    readonly replacement: string;
  },
): string {
  /**
   The page after the pass.
   */
  const page = restoreArchiveItalicTitles({
    slices: [
      pair({ sliceIndex: 0, target: archive, startOffset: 0, },),
      pair({ sliceIndex: 1, target: 'The cat napped.', startOffset: archive.length + 2, },),
    ],
    replacements: [{ sliceIndex: 1, replacementText: replacement, },],
    archiveOriginalSpans: [],
  },);
  return page.replacements
    .find(function isSecond(row,): boolean {
      return row.sliceIndex === 1;
    },)
    ?.replacementText ?? replacement;
}

await describe({
  name: 'restoreArchiveItalicTitles (class one hundred seventy-three)',
  children: [
    it({
      name: 'RESTORES a quoted title broken across lines to the archive italics, the period outside',
      fn: async () => {
        expect(secondSlice({
          archive: 'The cat loved *Whiskers: The Long Nap* (a cartoon).',
          replacement: 'The kitten loved “Whiskers:\nThe Long Nap”.\nShe purred.',
        },),).toBe('The kitten loved *Whiskers: The Long Nap*.\nShe purred.',);
      },
    },),
    it({
      name: 'MOVES a period or comma the quotes held outside the italics',
      fn: async () => {
        expect([
          secondSlice({
            archive: 'The cat loved *Whiskers: The Long Nap*.',
            replacement: 'The kitten loved “Whiskers: The Long Nap.”',
          },),
          secondSlice({
            archive: 'The cat loved *Whiskers: The Long Nap*.',
            replacement: 'After “Whiskers: The Long Nap,” she slept.',
          },),
        ],).toEqual([
          'The kitten loved *Whiskers: The Long Nap*.',
          'After *Whiskers: The Long Nap*, she slept.',
        ],);
      },
    },),
    it({
      name: 'LEAVES a quotation that is no archive italic span, a bold span and code',
      fn: async () => {
        expect([
          secondSlice({
            archive: 'The cat loved *Whiskers: The Long Nap*.',
            replacement: 'She said “Please nap.”',
          },),
          secondSlice({
            archive: 'The cat loved **Nap Time** most.',
            replacement: 'She loved “Nap Time” most.',
          },),
          secondSlice({
            archive: 'The cat loved *Whiskers: The Long Nap*.',
            replacement: 'She typed `“Whiskers: The Long Nap”` twice.',
          },),
        ],).toEqual([
          'She said “Please nap.”',
          'She loved “Nap Time” most.',
          'She typed `“Whiskers: The Long Nap”` twice.',
        ],);
      },
    },),
  ],
},);
