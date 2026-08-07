/**
 * Tests for rebuilding a translation from per-slice outcomes.
 *
 * The function is small and its failure is not: it assembles the text that
 * actually ships. A splice applied in the wrong order silently corrupts every
 * slice after the first, and because each slice is individually well-formed the
 * result still looks like plausible prose. So the cases here are mostly about
 * ORDER and about offsets that would drift.
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

import { spliceSlices, } from '../dist/final/node/index.mjs';

/**
 * Translation the slices are cut from.
 *
 * Three paragraphs of deliberately different lengths, so an off-by-one in
 * offset handling cannot coincidentally produce the right answer.
 */
const TARGET_TEXT = 'The cat sleeps.\n\nShe chases butterflies in the garden all afternoon.\n\nShe purrs.';

/**
 * Builds one target-side chunk covering a span of {@link TARGET_TEXT}.
 *
 * @param chunkIndex - position of this chunk
 *
 * @param startOffset - absolute start in target text
 *
 * @param endOffset - absolute exclusive end in target text
 *
 * @returns Chunk pair whose target side carries the span
 *
 * @example
 * ```ts
 * const pair = chunkAt({ chunkIndex: 0, startOffset: 0, endOffset: 15, },);
 * ```
 */
function chunkAt(
  {
    chunkIndex,
    startOffset,
    endOffset,
  }: {
    readonly chunkIndex: number;
    readonly startOffset: number;
    readonly endOffset: number;
  },
): {
  readonly source: {
    readonly chunkIndex: number;
    readonly nodes: readonly never[];
    readonly startOffset: number;
    readonly endOffset: number;
    readonly text: string;
  };
  readonly target: {
    readonly chunkIndex: number;
    readonly nodes: readonly never[];
    readonly startOffset: number;
    readonly endOffset: number;
    readonly text: string;
  };
} {
  /**
   * Span this chunk covers, read from the target text so offsets and text
   * cannot disagree.
   */
  const text = TARGET_TEXT.slice(
    startOffset,
    endOffset,
  );

  /**
   * Shared shape for both sides; only the target side is read by splicing.
   */
  const side = {
    chunkIndex,
    nodes: [],
    startOffset,
    endOffset,
    text,
  } as const;

  return {
    source: side,
    target: side,
  };
}

/**
 * Paragraph separator the fixture text uses.
 */
const PARAGRAPH_BREAK = '\n\n';

/**
 * Slices covering the three paragraphs, in document order.
 *
 * Offsets are DERIVED from the text rather than written down. Hand-counted
 * offsets are how a splice test ends up asserting the bug it was written to
 * catch, and this fixture only has to agree with itself.
 */
const SLICES = TARGET_TEXT.split(PARAGRAPH_BREAK,)
  .map(function toSlice(
    paragraph,
    chunkIndex,
  ) {
    /**
     * Absolute start of this paragraph, unique because the three differ.
     */
    const startOffset = TARGET_TEXT.indexOf(paragraph,);
    return chunkAt({
      chunkIndex,
      startOffset,
      endOffset: startOffset + paragraph.length,
    },);
  },);

/**
 * Builds one repair outcome for a slice.
 *
 * @param chunkIndex - slice this outcome is for
 *
 * @param repairedText - winning text for that slice
 *
 * @param changed - whether the repair beat unchanged
 *
 * @returns Outcome carrying only the fields splicing reads
 *
 * @example
 * ```ts
 * const outcome = outcomeFor({ chunkIndex: 0, repairedText: 'The cat naps.', changed: true, },);
 * ```
 */
function outcomeFor(
  {
    chunkIndex,
    repairedText,
    changed,
  }: {
    readonly chunkIndex: number;
    readonly repairedText: string;
    readonly changed: boolean;
  },
): {
  readonly chunkIndex: number;
  readonly repairedText: string;
  readonly changed: boolean;
  readonly issues: readonly never[];
  readonly resolvedIssueIds: readonly string[];
  readonly candidateResolvedIssueIds: readonly string[];
  readonly repairRegions: readonly never[];
  readonly accuracyPatchSelected: boolean;
  readonly refined: boolean;
  readonly nonTranslationVotes: number;
  readonly nonTranslationContradicted: boolean;
  readonly nonTranslationStanding: boolean;
  readonly heardCritics: number;
  readonly findings: readonly string[];
} {
  return {
    chunkIndex,
    repairedText,
    changed,
    issues: [],
    resolvedIssueIds: [],
    candidateResolvedIssueIds: [],
    repairRegions: [],
    // Splicing reads only chunkIndex, repairedText, and changed. The rest are
    // filled to satisfy the contract, deliberately at their inert values so
    // nothing here can look like a repair that happened.
    accuracyPatchSelected: false,
    refined: false,
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 0,
    findings: [],
  };
}

await describe({
  name: spliceSlices.name,
  children: [
    it({
      name: 'returns the translation untouched when nothing changed, so a run '
        + 'that repaired nothing cannot alter a single byte',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            outcomes: [
              outcomeFor({
                chunkIndex: 0,
                repairedText: 'The cat naps.',
                changed: false,
              },),
              outcomeFor({
                chunkIndex: 2,
                repairedText: 'She rumbles.',
                changed: false,
              },),
            ],
          },),
        ).toBe(TARGET_TEXT,);
      },
    },),

    it({
      name: 'splices a single changed slice in place, leaving the text on '
        + 'either side of it byte-identical',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            outcomes: [
              outcomeFor({
                chunkIndex: 1,
                repairedText: 'She chases butterflies all afternoon.',
                changed: true,
              },),
            ],
          },),
        ).toBe(
          'The cat sleeps.\n\nShe chases butterflies all afternoon.\n\nShe purrs.',
        );
      },
    },),

    it({
      name: 'applies MULTIPLE changed slices correctly even though each '
        + 'replacement changes the length of the text: this is the case that '
        + 'breaks if splicing runs in ascending order, because the first '
        + 'replacement shifts every later offset',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            outcomes: [
              // A much SHORTER replacement first, so ascending-order splicing
              // would read the third slice's offsets against a text that had
              // already shrunk by 36 characters.
              outcomeFor({
                chunkIndex: 1,
                repairedText: 'She chases butterflies.',
                changed: true,
              },),
              outcomeFor({
                chunkIndex: 2,
                repairedText: 'She purrs loudly and at length.',
                changed: true,
              },),
              outcomeFor({
                chunkIndex: 0,
                repairedText: 'The cat naps.',
                changed: true,
              },),
            ],
          },),
        ).toBe(
          'The cat naps.\n\nShe chases butterflies.\n\nShe purrs loudly and at length.',
        );
      },
    },),

    it({
      name: 'ignores outcome order entirely, since the driver hands them back '
        + 'in completion order rather than document order',
      fn: async () => {
        /**
         * Outcomes for the first and last slices, built once and spliced twice
         * in opposite orders.
         */
        const first = outcomeFor({
          chunkIndex: 0,
          repairedText: 'The cat naps.',
          changed: true,
        },);

        /**
         * Outcome for the final slice.
         */
        const last = outcomeFor({
          chunkIndex: 2,
          repairedText: 'She purrs loudly.',
          changed: true,
        },);

        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            outcomes: [
              first,
              last,
            ],
          },),
        ).toBe(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            outcomes: [
              last,
              first,
            ],
          },),
        );
      },
    },),

    it({
      name: 'keeps a changed slice whose replacement is empty, because deleting '
        + 'a slice is a legitimate repair and must not read as no-change',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            outcomes: [
              outcomeFor({
                chunkIndex: 2,
                repairedText: '',
                changed: true,
              },),
            ],
          },),
        ).toBe(
          'The cat sleeps.\n\nShe chases butterflies in the garden all afternoon.\n\n',
        );
      },
    },),

    it({
      name: 'THROWS when an outcome names a slice that does not exist, rather '
        + 'than silently dropping the repair: a lost slice means the driver and '
        + 'the slicer disagree, and shipping the remaining splices would hide it',
      fn: async () => {
        expect(function spliceMissingSlice() {
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            outcomes: [
              outcomeFor({
                chunkIndex: 9,
                repairedText: 'The dog barks.',
                changed: true,
              },),
            ],
          },);
        },).toThrow('repair lost slice 9',);
      },
    },),
  ],
},);
