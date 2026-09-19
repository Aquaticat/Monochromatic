/**
 Tests for the untranslated tail's own budget (owner, 2026-09-19).

 A page whose archive stops before the source does has a run of source-only
 slices after the pairing's last agreed pair, and nothing stands where they
 would go. The whole-page budget read that run against the corpus median less
 whatever the translated part carried, and on an archive that ran long it
 came up 80 code points short of the footnote definitions (XingZ608). The
 tail's expectation is read off the pairing instead: its source at the
 page's own paired expansion, with nothing to subtract. Cat-themed invention
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
  CORPUS_EXPANSION,
  interiorShortfall,
  makeInsertionChunk,
  readUntranslatedTail,
} from '../dist/final/node/index.mjs';

/**
 Source paragraph the archive translated.
 */
const PAIRED_SOURCE = '橘猫在窗台上睡了整个下午。';

/**
 Its archive rendering, running long at three code points per source code point.
 */
const PAIRED_TARGET = 'x'.repeat(PAIRED_SOURCE.length * 3,);

/**
 Source paragraph the archive never reached.
 */
const TAIL_SOURCE = '猫在夜里回家了。';

/**
 Builds one slice the archive translated.

 @param sliceIndex - slice position and index alike

 @returns Slice with content on both sides

 @example
 ```ts
 const slice = pairedSlice({ sliceIndex: 0, },);
 ```
 */
function pairedSlice({ sliceIndex, }: { readonly sliceIndex: number; },): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: PAIRED_SOURCE.length,
      text: PAIRED_SOURCE,
    },
    target: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: PAIRED_TARGET.length,
      text: PAIRED_TARGET,
    },
  };
}

/**
 Builds one source-only slice.

 @param sliceIndex - slice position and index alike

 @returns Slice with an insertion anchor on the target side

 @example
 ```ts
 const slice = insertionSlice({ sliceIndex: 1, },);
 ```
 */
function insertionSlice({ sliceIndex, }: { readonly sliceIndex: number; },): ChunkPair {
  return {
    source: {
      kind: 'content',
      sliceIndex,
      nodes: [],
      startOffset: 0,
      endOffset: TAIL_SOURCE.length,
      text: TAIL_SOURCE,
    },
    target: makeInsertionChunk({ sliceIndex, offset: 0, },),
  };
}

await describe({
  name: 'the untranslated tail read off the pairing',
  children: [
    it({
      name: 'READS THE TAIL as every source-only slice after the last agreed pair, '
        + 'at the page\'s own paired expansion',
      fn: async () => {
        const tail = readUntranslatedTail({
          slices: [
            pairedSlice({ sliceIndex: 0, },),
            insertionSlice({ sliceIndex: 1, },),
            pairedSlice({ sliceIndex: 2, },),
            insertionSlice({ sliceIndex: 3, },),
            insertionSlice({ sliceIndex: 4, },),
          ],
        },);
        expect([...tail.positions,],).toEqual([
          3,
          4,
        ],);
        expect(tail.expansion,).toBe(3,);
        expect(tail.sourceCodePoints,).toBe(TAIL_SOURCE.length * 2,);
        expect(tail.expected,).toBe(TAIL_SOURCE.length * 2 * 3,);
      },
    },),
    it({
      name: 'READS NO TAIL when the last slice is paired, and none when nothing was ever paired',
      fn: async () => {
        expect([...readUntranslatedTail({
          slices: [
            insertionSlice({ sliceIndex: 0, },),
            pairedSlice({ sliceIndex: 1, },),
          ],
        },).positions,],).toEqual([],);
        /**
         Reading of a preparation with no agreed pair to read the tail off.
         */
        const unpaired = readUntranslatedTail({
          slices: [
            insertionSlice({ sliceIndex: 0, },),
            insertionSlice({ sliceIndex: 1, },),
          ],
        },);
        expect([...unpaired.positions,],).toEqual([],);
        expect(unpaired.expansion,).toBe(CORPUS_EXPANSION,);
      },
    },),
    it({
      name: 'TAKES THE TAIL OUT OF THE INTERIOR BUDGET, so the interior reads what the translated part is missing',
      fn: async () => {
        /**
         Tail of one source-only slice after one agreed pair.
         */
        const tail = readUntranslatedTail({
          slices: [
            pairedSlice({ sliceIndex: 0, },),
            insertionSlice({ sliceIndex: 1, },),
          ],
        },);
        /**
         Whole page: the translated paragraph and the tail.
         */
        const sourceText = `${PAIRED_SOURCE}\n\n${TAIL_SOURCE}\n`;
        expect(interiorShortfall({
          sourceText,
          targetText: PAIRED_TARGET,
          tail,
        },),).toBe(Math.max(
          0,
          (PAIRED_SOURCE.length + 2) * CORPUS_EXPANSION - PAIRED_TARGET.length,
        ),);
      },
    },),
  ],
},);
