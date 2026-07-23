/**
 * Tests for paragraph-bound slice subdivision:
 * a generous budget keeps the section whole, a small budget groups
 * paragraphs without ever splitting one, coverage is contiguous with
 * exact document bytes, mismatched paragraph counts merge
 * monotonically, and the global base index lands on every slice.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  alignDocumentSections,
  type ChunkPair,
  parseDocument,
  subdivideChunkPair,
} from '../dist/final/neutral/index.mjs';

/**
 * Original with one section of three short paragraphs.
 */
const SOURCE_TEXT = `## 猫的一天

小猫早晨在窗台晒太阳。

小猫中午在垫子上打盹。

小猫晚上在院子里追蝴蝶。
`;

/**
 * Translation mirroring the section with three paragraphs.
 */
const TARGET_TEXT = `## A cat's day

The kitten suns on the windowsill each morning.

The kitten naps on its cushion at noon.

The kitten chases butterflies in the yard at night.
`;

/**
 * Translation collapsing the three source paragraphs into two.
 */
const TARGET_TWO_PARAGRAPHS = `## A cat's day

The kitten suns on the windowsill each morning and naps on its cushion at noon.

The kitten chases butterflies in the yard at night.
`;

/**
 * Builds the single aligned section pair of a fixture document pair.
 */
function alignedPair(
  {
    source,
    target,
  }: {
    readonly source: string;
    readonly target: string;
  },
): ChunkPair {
  /**
   * Alignment over the parsed fixture pair.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: source, },),
    target: parseDocument({ text: target, },),
  },);

  /**
   * Only pair of the single-section fixtures.
   */
  const [pair,] = alignment.pairs;
  if (pair === undefined)
    throw new Error('fixture must align into exactly one section pair',);
  return pair;
}

await describe({
  name: subdivideChunkPair.name,
  children: [
    it({
      name: 'keeps one slice under a generous budget',
      fn: async () => {
        const pair = alignedPair({
          source: SOURCE_TEXT,
          target: TARGET_TEXT,
        },);
        const slices = subdivideChunkPair({
          pair,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          baseIndex: 0,
          budget: 10_000,
        },);
        expect(slices,).toHaveLength(1,);
        expect(slices[0]?.target
          .startOffset,).toBe(pair.target
          .startOffset,);
        expect(slices[0]?.target
          .endOffset,).toBe(pair.target
          .endOffset,);
      },
    },),

    it({
      name: 'splits paragraphs into contiguous byte-exact slices under a small budget',
      fn: async () => {
        const pair = alignedPair({
          source: SOURCE_TEXT,
          target: TARGET_TEXT,
        },);
        const slices = subdivideChunkPair({
          pair,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          baseIndex: 0,
          budget: 50,
        },);
        expect(slices.length,).toBeGreaterThan(1,);

        // Coverage opens and closes on the section's own offsets.
        expect(slices[0]?.target
          .startOffset,).toBe(pair.target
          .startOffset,);
        expect(slices.at(-1,)?.target
          .endOffset,).toBe(pair.target
          .endOffset,);
        for (const [index, slice,] of slices.entries()) {
          // Slice text is the exact document byte range it claims.
          expect(slice.target
            .text,).toBe(TARGET_TEXT.slice(
            slice.target
              .startOffset,
            slice.target
              .endOffset,
          ),);
          expect(slice.source
            .text,).toBe(SOURCE_TEXT.slice(
            slice.source
              .startOffset,
            slice.source
              .endOffset,
          ),);

          /**
           * Preceding slice for monotone ordering.
           */
          const previous = slices[index - 1];
          if (previous !== undefined) {
            expect(slice.target
              .startOffset,).toBeGreaterThanOrEqual(previous.target
              .endOffset,);
          }
        }
      },
    },),

    it({
      name: 'merges the wider side monotonically on paragraph-count mismatch',
      fn: async () => {
        const pair = alignedPair({
          source: SOURCE_TEXT,
          target: TARGET_TWO_PARAGRAPHS,
        },);
        const slices = subdivideChunkPair({
          pair,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TWO_PARAGRAPHS,
          baseIndex: 0,
          budget: 30,
        },);
        expect(slices.length,).toBeGreaterThan(0,);
        // Both sides stay fully covered despite the mismatch.
        expect(slices[0]?.source
          .startOffset,).toBe(pair.source
          .startOffset,);
        expect(slices.at(-1,)?.source
          .endOffset,).toBe(pair.source
          .endOffset,);
        expect(slices[0]?.target
          .startOffset,).toBe(pair.target
          .startOffset,);
        expect(slices.at(-1,)?.target
          .endOffset,).toBe(pair.target
          .endOffset,);
      },
    },),

    it({
      name: 'stamps the global base index onto every slice',
      fn: async () => {
        const pair = alignedPair({
          source: SOURCE_TEXT,
          target: TARGET_TEXT,
        },);
        const slices = subdivideChunkPair({
          pair,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          baseIndex: 5,
          budget: 50,
        },);
        for (const [index, slice,] of slices.entries()) {
          expect(slice.target
            .chunkIndex,).toBe(5 + index,);
          expect(slice.source
            .chunkIndex,).toBe(5 + index,);
        }
      },
    },),
  ],
},);
