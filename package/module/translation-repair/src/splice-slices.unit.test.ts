/**
 * Tests for rebuilding a translation from per-slice replacements.
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

import {
  makeInsertionChunk,
  repairReplacements,
  type SliceReplacement,
  spliceSlices,
} from '../dist/final/node/index.mjs';

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
 * Builds one pair whose target side is an INSERTION ANCHOR at an offset.
 *
 * Zero-length spans used to be written as ordinary chunks covering nothing,
 * which is exactly the ambiguity `chunk-placement.ts` removes: a span covering
 * no text and a place where text is missing look identical from their offsets
 * alone, and only one of them may be written into.
 *
 * @param chunkIndex - position of this slice
 *
 * @param offset - boundary in {@link TARGET_TEXT} new text is written at
 *
 * @returns Pair whose target names that boundary
 *
 * @example
 * ```ts
 * const pair = anchorAt({ chunkIndex: 2, offset: FINAL_START, },);
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
) {
  return {
    // Never read by splicing, which writes into the target side only.
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
 * Where the final paragraph begins, which is where a slice with no existing
 * translation would be written in.
 */
const FINAL_START = TARGET_TEXT.indexOf('She purrs.',);

/**
 * Builds one replacement.
 *
 * @param chunkIndex - slice to write into
 *
 * @param replacementText - text to write there
 *
 * @returns Replacement as a lane emits it
 *
 * @example
 * ```ts
 * const replacement = write({ chunkIndex: 0, replacementText: 'The cat naps.', },);
 * ```
 */
function write(
  {
    chunkIndex,
    replacementText,
  }: {
    readonly chunkIndex: number;
    readonly replacementText: string;
  },
): SliceReplacement {
  return {
    chunkIndex,
    replacementText,
  };
}

/**
 * Builds one repair outcome, for the mapping that feeds splicing.
 *
 * @param chunkIndex - slice this outcome is for
 *
 * @param repairedText - winning text for that slice
 *
 * @param changed - whether the repair beat unchanged
 *
 * @returns Outcome carrying only the fields the mapping reads
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
  readonly heardCriticIds: readonly never[];
  readonly claimAttributions: readonly never[];
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
    // The mapping reads only chunkIndex, repairedText, and changed. The rest
    // are filled to satisfy the contract, deliberately at their inert values so
    // nothing here can look like a repair that happened.
    accuracyPatchSelected: false,
    refined: false,
    nonTranslationVotes: 0,
    nonTranslationContradicted: false,
    nonTranslationStanding: false,
    heardCritics: 0,
    heardCriticIds: [],
    claimAttributions: [],
    findings: [],
  };
}

await describe({
  name: spliceSlices.name,
  children: [
    it({
      name: 'returns the translation untouched when there is nothing to write, '
        + 'so a run that repaired nothing cannot alter a single byte',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [],
          },),
        ).toBe(TARGET_TEXT,);
      },
    },),

    it({
      name: 'splices a single slice in place, leaving the text on either side '
        + 'of it byte-identical',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [
              write({
                chunkIndex: 1,
                replacementText: 'She chases butterflies all afternoon.',
              },),
            ],
          },),
        ).toBe(
          'The cat sleeps.\n\nShe chases butterflies all afternoon.\n\nShe purrs.',
        );
      },
    },),

    it({
      name: 'applies MULTIPLE slices correctly even though each replacement '
        + 'changes the length of the text: this is the case that breaks if '
        + 'splicing runs in ascending order, because the first replacement '
        + 'shifts every later offset',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [
              // A much SHORTER replacement first, so ascending-order splicing
              // would read the third slice's offsets against a text that had
              // already shrunk by 36 characters.
              write({
                chunkIndex: 1,
                replacementText: 'She chases butterflies.',
              },),
              write({
                chunkIndex: 2,
                replacementText: 'She purrs loudly and at length.',
              },),
              write({
                chunkIndex: 0,
                replacementText: 'The cat naps.',
              },),
            ],
          },),
        ).toBe(
          'The cat naps.\n\nShe chases butterflies.\n\nShe purrs loudly and at length.',
        );
      },
    },),

    it({
      name: 'ignores the order replacements arrive in, since a driver hands '
        + 'them back in completion order rather than document order',
      fn: async () => {
        /**
         * Replacement for the first slice, spliced twice in opposite orders.
         */
        const first = write({
          chunkIndex: 0,
          replacementText: 'The cat naps.',
        },);

        /**
         * Replacement for the final slice.
         */
        const last = write({
          chunkIndex: 2,
          replacementText: 'She purrs loudly.',
        },);

        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [
              first,
              last,
            ],
          },),
        ).toBe(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [
              last,
              first,
            ],
          },),
        );
      },
    },),

    it({
      name: 'keeps a replacement that is EMPTY, because deleting a slice is a '
        + 'legitimate result and must not read as no-change',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [
              write({
                chunkIndex: 2,
                replacementText: '',
              },),
            ],
          },),
        ).toBe(
          'The cat sleeps.\n\nShe chases butterflies in the garden all afternoon.\n\n',
        );
      },
    },),

    it({
      name: 'INSERTS into a zero-length span at exactly that offset, which is '
        + 'the case the translate lane exists for: a passage with no existing '
        + 'translation has nothing to replace and everything to write',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: [
              ...SLICES.slice(
                0,
                2,
              ),
              anchorAt({
                chunkIndex: 2,
                offset: FINAL_START,
              },),
            ],
            replacements: [
              write({
                chunkIndex: 2,
                replacementText: 'She dozes in the sun. ',
              },),
            ],
          },),
        ).toBe(
          'The cat sleeps.\n\nShe chases butterflies in the garden all afternoon.\n\n'
          + 'She dozes in the sun. She purrs.',
        );
      },
    },),

    it({
      name: 'writes SEVERAL insertions sharing one offset in document order '
        + 'rather than reversed, which is what a section whose translation is '
        + 'missing entirely looks like once slicing cuts it into several source '
        + 'slices with one place to put them',
      fn: async () => {
        expect(
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: [
              ...SLICES.slice(
                0,
                2,
              ),
              anchorAt({
                chunkIndex: 2,
                offset: FINAL_START,
              },),
              anchorAt({
                chunkIndex: 3,
                offset: FINAL_START,
              },),
            ],
            replacements: [
              write({
                chunkIndex: 3,
                replacementText: 'Then she stretches. ',
              },),
              write({
                chunkIndex: 2,
                replacementText: 'She dozes in the sun. ',
              },),
            ],
          },),
        ).toBe(
          'The cat sleeps.\n\nShe chases butterflies in the garden all afternoon.\n\n'
          + 'She dozes in the sun. Then she stretches. She purrs.',
        );
      },
    },),

    it({
      name: 'THROWS when a replacement names a slice that does not exist, '
        + 'rather than silently dropping it: a lost slice means the driver and '
        + 'the slicer disagree, and shipping the remaining splices would hide it',
      fn: async () => {
        expect(function spliceMissingSlice() {
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [
              write({
                chunkIndex: 9,
                replacementText: 'The dog barks.',
              },),
            ],
          },);
        },).toThrow('no slice 9',);
      },
    },),

    it({
      name: 'THROWS when two SLICES carry one index, which has happened: a '
        + 'section only one side carried came back holding its section index '
        + 'while every other path stamped the global one. Keyed by index, the '
        + 'second slice would replace the first and one of them would become '
        + 'unreachable while its replacement landed on the other',
      fn: async () => {
        expect(function spliceCollidingSlices() {
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: [
              ...SLICES,
              anchorAt({
                chunkIndex: 0,
                offset: FINAL_START,
              },),
            ],
            replacements: [
              write({
                chunkIndex: 0,
                replacementText: 'The cat naps.',
              },),
            ],
          },);
        },).toThrow('two slices carry one index',);
      },
    },),

    it({
      name: 'THROWS when two replacements name ONE slice, since whichever '
        + 'applied second would overwrite the other and the winner would depend '
        + 'on sort order. Two lanes writing the same slice is exactly the shape '
        + 'that produces this, and it must not resolve itself quietly',
      fn: async () => {
        expect(function spliceDuplicate() {
          spliceSlices({
            targetText: TARGET_TEXT,
            slices: SLICES,
            replacements: [
              write({
                chunkIndex: 1,
                replacementText: 'She chases butterflies.',
              },),
              write({
                chunkIndex: 1,
                replacementText: 'She chases moths.',
              },),
            ],
          },);
        },).toThrow('two replacements name one slice',);
      },
    },),
  ],
},);

await describe({
  name: repairReplacements.name,
  children: [
    it({
      name: 'drops outcomes that changed nothing rather than writing them back '
        + 'over themselves, since a no-op write still reads as a slice this '
        + 'lane touched in every later diff and count',
      fn: async () => {
        expect(repairReplacements({ outcomes: [
          outcomeFor({
            chunkIndex: 0,
            repairedText: 'The cat naps.',
            changed: false,
          },),
          outcomeFor({
            chunkIndex: 2,
            repairedText: 'She rumbles.',
            changed: true,
          },),
        ], },),).toEqual([
          {
            chunkIndex: 2,
            replacementText: 'She rumbles.',
          },
        ],);
      },
    },),

    it({
      name: 'carries an EMPTY repair through, because a repair that deletes a '
        + 'slice is a change and dropping it would ship the text it deleted',
      fn: async () => {
        expect(repairReplacements({ outcomes: [
          outcomeFor({
            chunkIndex: 1,
            repairedText: '',
            changed: true,
          },),
        ], },),).toHaveLength(1,);
      },
    },),
  ],
},);
