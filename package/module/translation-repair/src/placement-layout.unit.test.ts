/**
 * Tests for the check that says target spans can be written back.
 *
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
  assertPlacementLayout,
  type ChunkPair,
  makeInsertionChunk,
  PlacementLayoutError,
  prepareDocumentPair,
} from '../dist/final/node/index.mjs';

/**
 * Document the spans index into.
 */
const TARGET_TEXT = 'The cat sleeps.\n\nShe purrs.';

/**
 * Builds one pair covering a span of {@link TARGET_TEXT}.
 *
 * @param chunkIndex - position of this slice
 *
 * @param startOffset - absolute start
 *
 * @param endOffset - absolute exclusive end
 *
 * @returns Pair whose target side carries that span
 *
 * @example
 * ```ts
 * const pair = spanAt({ chunkIndex: 0, startOffset: 0, endOffset: 15, },);
 * ```
 */
function spanAt(
  {
    chunkIndex,
    startOffset,
    endOffset,
  }: {
    readonly chunkIndex: number;
    readonly startOffset: number;
    readonly endOffset: number;
  },
): ChunkPair {
  /**
   * Both sides, since only the target one is read here.
   */
  const side = {
    chunkIndex,
    nodes: [],
    startOffset,
    endOffset,
    text: TARGET_TEXT.slice(
      startOffset,
      endOffset,
    ),
  };
  return {
    source: side,
    target: side,
  };
}

/**
 * Builds one pair whose target is an anchor at an offset.
 *
 * @param chunkIndex - position of this slice
 *
 * @param offset - boundary it names
 *
 * @returns Pair whose target names that boundary
 *
 * @example
 * ```ts
 * const pair = anchorAt({ chunkIndex: 1, offset: 17, },);
 * ```
 */
function anchorAt(
  {
    chunkIndex,
    offset,
  }: {
    readonly chunkIndex: number;
    readonly offset: number;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex,
      nodes: [],
      startOffset: 0,
      endOffset: 0,
      text: '猫',
    },
    target: makeInsertionChunk({
      chunkIndex,
      offset,
    },),
  };
}

/**
 * Where the second paragraph starts.
 */
const SECOND_START = TARGET_TEXT.indexOf('She purrs.',);

await describe({
  name: assertPlacementLayout.name,
  children: [
    it({
      name: 'accepts what a real preparation produces, which is the case that has to keep passing: every '
        + 'span there comes from a disjoint run of nodes, so the rule holds by construction and a guard '
        + 'nobody can satisfy is worse than no guard',
      fn: async () => {
        /** Two sections on each side. */
        const prepared = prepareDocumentPair({
          sourceText: '## 简介\n\n猫猫喜欢晒太阳。\n\n## 习惯\n\n它每天都在窗边睡觉。\n',
          targetText: '## Intro\n\nThe cat likes the sun.\n\n## Habits\n\nIt sleeps by the window daily.\n',
        },);
        expect(function checkRealPreparation() {
          assertPlacementLayout({
            slices: prepared.slices,
            targetText: prepared.targetText,
          },);
        },).not.toThrow();
      },
    },),
    it({
      name: 'accepts every legal shape an insertion makes: several at one boundary, one at a span`s start '
        + 'meaning before it, and one at a span`s end. Each is a placement the translate lane produces, '
        + 'and refusing any of them would refuse the work rather than a defect',
      fn: async () => {
        expect(function checkLegalShapes() {
          assertPlacementLayout({
            slices: [
              spanAt({
                chunkIndex: 0,
                startOffset: 0,
                endOffset: 15,
              },),
              anchorAt({
                chunkIndex: 1,
                offset: 15,
              },),
              anchorAt({
                chunkIndex: 2,
                offset: SECOND_START,
              },),
              anchorAt({
                chunkIndex: 3,
                offset: SECOND_START,
              },),
              spanAt({
                chunkIndex: 4,
                startOffset: SECOND_START,
                endOffset: TARGET_TEXT.length,
              },),
            ],
            targetText: TARGET_TEXT,
          },);
        },).not.toThrow();
      },
    },),
    it({
      name: 'REFUSES a span running past the document, which is the failure that produces plausible text '
        + 'rather than a diagnostic: slicing a string CLAMPS, so an assembly reading past the end returns '
        + 'a document nobody can tell is wrong from the output',
      fn: async () => {
        expect(function checkPastEnd() {
          assertPlacementLayout({
            slices: [
              {
                source: spanAt({
                  chunkIndex: 0,
                  startOffset: 0,
                  endOffset: 15,
                },).source,
                target: {
                  chunkIndex: 0,
                  nodes: [],
                  startOffset: 0,
                  endOffset: TARGET_TEXT.length + 40,
                  text: TARGET_TEXT,
                },
              },
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow(PlacementLayoutError,);
      },
    },),
    it({
      name: 'REFUSES a placement that moves BACKWARDS, which is one statement covering overlap too: two '
        + 'spans that overlap, two starting at one offset, and a list sorted differently from its slices '
        + 'are all the same defect seen from different sides',
      fn: async () => {
        expect(function checkBackwards() {
          assertPlacementLayout({
            slices: [
              spanAt({
                chunkIndex: 0,
                startOffset: SECOND_START,
                endOffset: TARGET_TEXT.length,
              },),
              spanAt({
                chunkIndex: 1,
                startOffset: 0,
                endOffset: 15,
              },),
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow('would move or overwrite',);
      },
    },),
    it({
      name: 'REFUSES an anchor strictly INSIDE a span, and an anchor that follows a span it shares a '
        + 'boundary with. Writing either one lands text in the middle of a passage the same run is '
        + 'replacing, and which of them wins depends on sort order',
      fn: async () => {
        expect(function checkAnchorInside() {
          assertPlacementLayout({
            slices: [
              spanAt({
                chunkIndex: 0,
                startOffset: 0,
                endOffset: 15,
              },),
              anchorAt({
                chunkIndex: 1,
                offset: 4,
              },),
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow(PlacementLayoutError,);
        expect(function checkAnchorAfterItsSpan() {
          assertPlacementLayout({
            slices: [
              spanAt({
                chunkIndex: 0,
                startOffset: 0,
                endOffset: 15,
              },),
              anchorAt({
                chunkIndex: 1,
                offset: 0,
              },),
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow(PlacementLayoutError,);
      },
    },),
    it({
      name: 'REFUSES content covering nothing, since an empty span and a place where text is missing are '
        + 'indistinguishable by their offsets, and only one of them may be written INTO',
      fn: async () => {
        expect(function checkHollowContent() {
          assertPlacementLayout({
            slices: [
              spanAt({
                chunkIndex: 0,
                startOffset: 15,
                endOffset: 15,
              },),
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow('content covering nothing',);
      },
    },),
    it({
      name: 'REFUSES text the document does not hold at those offsets, which is how slices cut from ANOTHER '
        + 'document reach assembly: the offsets are all in range, every span is ordered, and the result '
        + 'is a confident splice into a passage nobody read',
      fn: async () => {
        expect(function checkForeignSlices() {
          assertPlacementLayout({
            slices: [
              {
                source: anchorAt({
                  chunkIndex: 0,
                  offset: 0,
                },).source,
                target: {
                  chunkIndex: 0,
                  nodes: [],
                  startOffset: 0,
                  endOffset: 15,
                  text: 'The dog barks.!',
                },
              },
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow('cut from another document',);
      },
    },),
    it({
      name: 'REFUSES an anchor that claims to cover text, and an offset that is not a whole number. Both '
        + 'are values the constructor cannot produce and the structural type still permits',
      fn: async () => {
        expect(function checkFatAnchor() {
          assertPlacementLayout({
            slices: [
              {
                source: anchorAt({
                  chunkIndex: 0,
                  offset: 0,
                },).source,
                target: {
                  kind: 'insertion',
                  chunkIndex: 0,
                  nodes: [],
                  startOffset: 0,
                  endOffset: 15,
                  text: 'The cat sleeps.',
                },
              },
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow('a place covers none of the three',);
        expect(function checkFractionalOffset() {
          assertPlacementLayout({
            slices: [
              {
                source: anchorAt({
                  chunkIndex: 0,
                  offset: 0,
                },).source,
                target: {
                  chunkIndex: 0,
                  nodes: [],
                  startOffset: 0,
                  endOffset: 1 / 2,
                  text: '',
                },
              },
            ],
            targetText: TARGET_TEXT,
          },);
        },).toThrow('whole numbers',);
      },
    },),
  ],
},);
