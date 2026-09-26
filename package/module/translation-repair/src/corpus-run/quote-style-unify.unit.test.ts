/**
 Guards class one hundred forty-two (XingZ6012, 2026-09-26): the page wrote
 its quotes curly (134 curly double marks, 108 curly apostrophes), yet four
 archive paragraphs no lane rewrote kept their straight marks ("take it
 slow", "didn't"), because the typography restoration reads only the text a
 lane replaced. The page-assembly pass reads every slice and brings its
 prose quotes to the page's majority style, outside tags and code.

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
  type SliceReplacement,
  unifyQuoteStyle,
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
 Text the unified page carries at slice 0.

 @param archive - slice 0's archive text, which no lane replaced

 @param replacement - what a lane wrote for slice 1

 @returns Slice 0's text after the pass

 @example
 ```ts
 firstSlice({ archive: 'The cat said "meow".', replacement: '“Purr.” “Warm.”', },);
 ```
 */
function firstSlice(
  {
    archive,
    replacement,
  }: {
    readonly archive: string;
    readonly replacement: string;
  },
): string {
  /**
   Lane rows: slice 1 alone.
   */
  const replacements: readonly SliceReplacement[] = [{
    sliceIndex: 1,
    replacementText: replacement,
  },];
  /**
   The page after the pass.
   */
  const unified = unifyQuoteStyle({
    slices: [
      pair({
        sliceIndex: 0,
        target: archive,
        startOffset: 0,
      },),
      pair({
        sliceIndex: 1,
        target: 'The cat napped.',
        startOffset: archive.length + 2,
      },),
    ],
    replacements,
    archiveOriginalSpans: [],
  },);
  return unified.replacements
    .find(function isFirst(row,): boolean {
      return row.sliceIndex === 0;
    },)
    ?.replacementText ?? archive;
}

await describe({
  name: 'unifyQuoteStyle (class one hundred forty-two)',
  children: [
    it({
      name: 'CURLS an archive slice\'s straight quotes and apostrophe on a page written curly',
      fn: async () => {
        expect(firstSlice({
          archive: 'The cat said "meow" and didn\'t stop.',
          replacement: '“Purr,” said the cat. “Warm.” It’s the cat’s nap.',
        },),).toBe('The cat said “meow” and didn’t stop.',);
      },
    },),
    it({
      name: 'LEAVES a page whose majority is straight',
      fn: async () => {
        expect(firstSlice({
          archive: 'The cat said "meow" and "purr" and didn\'t stop, wasn\'t it.',
          replacement: '“Purr,” it’s warm.',
        },),).toBe('The cat said "meow" and "purr" and didn\'t stop, wasn\'t it.',);
      },
    },),
    it({
      name: 'LEAVES tag attributes and code spans straight',
      fn: async () => {
        expect(firstSlice({
          archive: '<Ring text="meow" /> The cat typed `say "hi"` and said "hi".',
          replacement: '“Purr,” said the cat. “Warm.” “Soft.” It’s the cat’s nap.',
        },),).toBe('<Ring text="meow" /> The cat typed `say "hi"` and said “hi”.',);
      },
    },),
  ],
},);
