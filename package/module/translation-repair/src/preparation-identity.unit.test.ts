/**
 * Tests for the name a slicing gives itself.
 *
 * WHAT THESE PIN is one property in each direction. A preparation that differs
 * anywhere a lane can see must get a different name, or two slicings join
 * silently and every row of the comparison is individually well formed while
 * describing two different documents. A preparation that is the same must get
 * the same name however the run around it differed, or the field answers "was
 * this the same attempt" rather than "was this the same slicing", and no
 * resumed run could ever be compared with a cold one.
 *
 * The blank-content case is the one this exists for: a content slice that
 * happens to be empty and a place the archive never translated both carry the
 * empty string, and only the placement kind separates them.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type ChunkPair,
  makeInsertionChunk,
  type PreparedDocumentPair,
  preparationIdentity,
} from '../dist/final/node/index.mjs';

/**
 * Builds a content slice pair.
 *
 * @param index - global slice index
 *
 * @param source - original text
 *
 * @param target - archive translation
 *
 * @returns Pair with content on both sides
 *
 * @example
 * ```ts
 * const pair = contentPair({ index: 0, source: '猫', target: 'The cat.', },);
 * ```
 */
function contentPair(
  {
    index,
    source,
    target,
  }: {
    readonly index: number;
    readonly source: string;
    readonly target: string;
  },
): ChunkPair {
  return {
    source: {
      chunkIndex: index,
      nodes: [],
      startOffset: 0,
      endOffset: source.length,
      text: source,
    },
    target: {
      chunkIndex: index,
      nodes: [],
      startOffset: 0,
      endOffset: target.length,
      text: target,
    },
  };
}

/**
 * Builds a preparation around given slices.
 *
 * @param slices - prepared pairs
 *
 * @param sourceText - whole original document
 *
 * @param targetText - whole archive translation
 *
 * @param lineStructured - indices governed line by line
 *
 * @param identityContext - declared names, absent when omitted
 *
 * @returns Preparation shaped as `prepareDocumentPair` returns one
 *
 * @example
 * ```ts
 * const prepared = preparationOf({ slices, sourceText: '猫', targetText: 'The cat.', },);
 * ```
 */
function preparationOf(
  {
    slices,
    sourceText,
    targetText,
    lineStructured = [],
    identityContext,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sourceText: string;
    readonly targetText: string;
    readonly lineStructured?: readonly number[];
    readonly identityContext?: string;
  },
): PreparedDocumentPair {
  return {
    sourceText,
    targetText,
    slices,
    lineStructuredSliceIndices: new Set(lineStructured,),
    alignmentFindings: [],
    alignmentPairCount: slices.length,
    ...(identityContext === undefined) ? {} : { identityContext, },
  } as unknown as PreparedDocumentPair;
}

/**
 * Preparation every case here is compared against.
 *
 * @returns Two content slices about a cat
 *
 * @example
 * ```ts
 * const prepared = catPreparation();
 * ```
 */
function catPreparation(): PreparedDocumentPair {
  return preparationOf({
    sourceText: '猫猫在睡觉。猫猫在吃饭。',
    targetText: 'The cat sleeps.\n\nThe cat eats.',
    slices: [
      contentPair({
        index: 0,
        source: '猫猫在睡觉。',
        target: 'The cat sleeps.',
      },),
      contentPair({
        index: 1,
        source: '猫猫在吃饭。',
        target: 'The cat eats.',
      },),
    ],
  },);
}

await describe({
  name: preparationIdentity.name,
  children: [
    it({
      name:
        'gives one slicing the same name twice, and gives it that name again from a separately built '
        + 'preparation of the same shape, since a resumed run rebuilds its preparation and would '
        + 'otherwise be uncomparable with the run it resumed',
      fn: async () => {
        expect(preparationIdentity({ prepared: catPreparation(), },),)
          .toBe(preparationIdentity({ prepared: catPreparation(), },),);
      },
    },),
    it({
      name:
        'separates a blank content slice from a place the archive never translated, which is the pair '
        + 'nothing else can separate: both carry the empty string, so only the placement kind says '
        + 'whether the archive translates the passage at all',
      fn: async () => {
        /**
         * Second slice as a content slice the archive left blank.
         */
        const blankContent = preparationOf({
          sourceText: '猫猫在睡觉。猫猫在吃饭。',
          targetText: 'The cat sleeps.\n\n',
          slices: [
            contentPair({
              index: 0,
              source: '猫猫在睡觉。',
              target: 'The cat sleeps.',
            },),
            contentPair({
              index: 1,
              source: '猫猫在吃饭。',
              target: '',
            },),
          ],
        },);

        /**
         * Same document with that slice as an anchor instead.
         */
        const anchored = preparationOf({
          sourceText: '猫猫在睡觉。猫猫在吃饭。',
          targetText: 'The cat sleeps.\n\n',
          slices: [
            contentPair({
              index: 0,
              source: '猫猫在睡觉。',
              target: 'The cat sleeps.',
            },),
            {
              source: contentPair({
                index: 1,
                source: '猫猫在吃饭。',
                target: '',
              },).source,
              target: makeInsertionChunk({
                chunkIndex: 1,
                offset: 0,
              },),
            },
          ],
        },);
        expect(preparationIdentity({ prepared: blankContent, },),)
          .not
          .toBe(preparationIdentity({ prepared: anchored, },),);
      },
    },),
    it({
      name:
        'separates two slicings that pair the same passages DIFFERENTLY, which equal slice counts and '
        + 'equal texts cannot: the same wordings joined the other way round is a different document',
      fn: async () => {
        /**
         * The cat preparation with its two targets swapped.
         */
        const swapped = preparationOf({
          sourceText: '猫猫在睡觉。猫猫在吃饭。',
          targetText: 'The cat sleeps.\n\nThe cat eats.',
          slices: [
            contentPair({
              index: 0,
              source: '猫猫在睡觉。',
              target: 'The cat eats.',
            },),
            contentPair({
              index: 1,
              source: '猫猫在吃饭。',
              target: 'The cat sleeps.',
            },),
          ],
        },);
        expect(preparationIdentity({ prepared: catPreparation(), },),)
          .not
          .toBe(preparationIdentity({ prepared: swapped, },),);
      },
    },),
    it({
      name:
        'separates two slicings whose slice texts concatenate to the same document, since where the '
        + 'boundaries fell decides what every stage was asked and a total is not a slicing',
      fn: async () => {
        /**
         * Both sentences in one slice rather than two.
         */
        const merged = preparationOf({
          sourceText: '猫猫在睡觉。猫猫在吃饭。',
          targetText: 'The cat sleeps.\n\nThe cat eats.',
          slices: [
            contentPair({
              index: 0,
              source: '猫猫在睡觉。猫猫在吃饭。',
              target: 'The cat sleeps.\n\nThe cat eats.',
            },),
          ],
        },);
        expect(preparationIdentity({ prepared: catPreparation(), },),)
          .not
          .toBe(preparationIdentity({ prepared: merged, },),);
      },
    },),
    it({
      name:
        'separates a slice governed line by line from the same slice governed freely, because that flag '
        + 'changes what every stage is allowed to do to the passage',
      fn: async () => {
        /**
         * Same slicing with its first slice under line governance.
         */
        const governed = preparationOf({
          sourceText: '猫猫在睡觉。猫猫在吃饭。',
          targetText: 'The cat sleeps.\n\nThe cat eats.',
          lineStructured: [0,],
          slices: [
            contentPair({
              index: 0,
              source: '猫猫在睡觉。',
              target: 'The cat sleeps.',
            },),
            contentPair({
              index: 1,
              source: '猫猫在吃饭。',
              target: 'The cat eats.',
            },),
          ],
        },);
        expect(preparationIdentity({ prepared: catPreparation(), },),)
          .not
          .toBe(preparationIdentity({ prepared: governed, },),);
      },
    },),
    it({
      name:
        'separates absent declared names from empty ones, since one asks the models about a document '
        + 'with no identity context and the other about one whose context is nothing',
      fn: async () => {
        /**
         * Same slicing carrying an empty identity context.
         */
        const empty = preparationOf({
          sourceText: '猫猫在睡觉。猫猫在吃饭。',
          targetText: 'The cat sleeps.\n\nThe cat eats.',
          identityContext: '',
          slices: catPreparation().slices,
        },);
        expect(preparationIdentity({ prepared: catPreparation(), },),)
          .not
          .toBe(preparationIdentity({ prepared: empty, },),);
      },
    },),
    it({
      name:
        'separates two documents differing only OUTSIDE every slice, which no row can see: a section '
        + 'neither side sliced appears in no row at all, so the whole texts are named beside them',
      fn: async () => {
        /**
         * Same slices under a document carrying an extra unsliced heading.
         */
        const extra = preparationOf({
          sourceText: '猫猫在睡觉。猫猫在吃饭。猫猫在看鸟。',
          targetText: 'The cat sleeps.\n\nThe cat eats.',
          slices: catPreparation().slices,
        },);
        expect(preparationIdentity({ prepared: catPreparation(), },),)
          .not
          .toBe(preparationIdentity({ prepared: extra, },),);
      },
    },),
    it({
      name:
        'names the scheme in the value, so a later scheme cannot be mistaken for this one by a reader '
        + 'that only sees sixty-four hex characters',
      fn: async () => {
        expect(preparationIdentity({ prepared: catPreparation(), },),)
          .toMatch('sha256-preparation-v1:',);
      },
    },),
  ],
},);
