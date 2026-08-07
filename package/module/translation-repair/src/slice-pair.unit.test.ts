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
} from '../dist/final/node/index.mjs';

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
 * Builds a marked paragraph of an exact character length: an `M{index}`
 * tag that both sides' corresponding paragraphs carry, padded to size with
 * cat-themed filler. Equal-length marker tags let a slice's source and
 * target marker sets be compared for drift.
 */
function markedParagraph(
  {
    index,
    size,
  }: {
    readonly index: number;
    readonly size: number;
  },
): string {
  /**
   * Marker tag matching paragraphs share across the two sides.
   */
  const tag = `M${String(index,)} `;
  return tag
    + 'cat '
      .repeat(Math.ceil((size - tag.length) / 'cat '.length,),)
      .slice(
        0,
        size - tag.length,
      );
}

/**
 * Joins marked paragraphs of the given span sizes into one document, so a
 * source and target built from equal-length size lists share paragraph
 * count and marker order while diverging in per-paragraph length.
 */
function markedDocument(
  { sizes, }: { readonly sizes: readonly number[]; },
): string {
  return `${sizes
    .map(function toParagraph(
      size,
      index,
    ) {
      return markedParagraph({ index, size, },);
    },)
    .join('\n\n',)}\n`;
}

/**
 * Marker indices the equal-count lockstep fixtures carry, in order.
 */
const LOCKSTEP_MARKERS = [
  0,
  1,
  2,
  3,
  4,
  5,
];

/**
 * Extracts the ordered marker tags a slice side contains, by substring
 * presence so no inline regex is needed.
 */
function sliceMarkers(
  { text, }: { readonly text: string; },
): string {
  return LOCKSTEP_MARKERS
    .filter(function present(index,) {
      return text.includes(`M${String(index,)} `,);
    },)
    .map(function toTag(index,) {
      return `M${String(index,)}`;
    },)
    .join(',',);
}

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
      name: 'pairs equal node counts in lockstep without off-by-one drift (Arita regression)',
      fn: async () => {
        /**
         * Dense original: small adjacent nodes merge on odd boundaries.
         */
        const source = markedDocument({ sizes: [35, 10, 10, 35, 10, 10,], },);

        /**
         * Longer translation: same paragraph count, mirrored sizes so the
         * independent-budget grouping would merge on even boundaries and
         * drift the pairing by one (the Arita non-translation false block).
         */
        const target = markedDocument({ sizes: [10, 10, 35, 10, 10, 35,], },);
        const pair = alignedPair({
          source,
          target,
        },);
        // Equal paragraph counts are the lockstep precondition.
        expect(pair.source
          .nodes
          .length,).toBe(pair.target
          .nodes
          .length,);

        const slices = subdivideChunkPair({
          pair,
          sourceText: source,
          targetText: target,
          baseIndex: 0,
          budget: 40,
        },);

        /**
         * Ordered markers gathered across every slice's original side.
         */
        const covered: string[] = [];
        for (const slice of slices) {
          // Corresponding paragraphs stay in the same slice: no drift.
          expect(sliceMarkers({ text: slice.source
            .text, },),).toBe(sliceMarkers({ text: slice.target
            .text, },),);
          covered.push(sliceMarkers({ text: slice.source
            .text, },),);
        }
        // Every marker is covered exactly once, in document order.
        expect(covered.join(',',),).toBe('M0,M1,M2,M3,M4,M5',);
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
