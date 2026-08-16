/**
 * Tests for the translate lane's per-slice wordings.
 *
 * WHAT THESE PIN is the fix this file was written for: a stage that heard NO
 * TRANSLATOR keeps the archive's wording as its output text, and passing that
 * through as a decision states that the lane examined the passage and chose the
 * archive. It did not. Nobody answered. Every lane comparison run before this
 * counted those slices as agreement with the archive, which is the window
 * trial's lost-judge defect wearing the producing stage's clothes.
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
  LaneSliceCoverageError,
  makeInsertionChunk,
  type TranslateSliceRecord,
  translateLaneWordings,
} from '../dist/final/node/index.mjs';

/**
 * Builds one prepared slice pair.
 *
 * @param index - global slice index both sides carry
 *
 * @param target - archive translation of this slice
 *
 * @returns Pair shaped as preparation produces
 *
 * @example
 * ```ts
 * const pair = pairOf({ index: 0, target: 'The cat naps.', },);
 * ```
 */
function pairOf(
  {
    index,
    target,
  }: {
    readonly index: number;
    readonly target: string;
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
  return {
    source: {
      chunkIndex: index,
      nodes: [],
      startOffset: 0,
      endOffset: 1,
      text: 'source of the nap',
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
 * Builds one settled record with the parts this builder reads.
 *
 * @param chunkIndex - slice this record settles
 *
 * @param outputText - what the driver accepted for assembly, which for an
 * unheard slice is the archive's own wording rather than anything produced
 *
 * @param heardTranslators - how many voices the producing stage actually heard,
 * which is the whole question here
 *
 * @returns Record shaped as the driver settles one
 *
 * @example
 * ```ts
 * const record = recordFor({ chunkIndex: 0, outputText: 'The cat naps.', heardTranslators: 2, },);
 * ```
 */
function recordFor(
  {
    chunkIndex,
    outputText,
    heardTranslators,
  }: {
    readonly chunkIndex: number;
    readonly outputText: string;
    readonly heardTranslators: number;
  },
): TranslateSliceRecord {
  return {
    kind: 'translate-slice',
    schemaVersion: 1,
    chunkIndex,
    outputText,
    changed: false,
    disposition: 'stage-result',
    findings: [],
    stageResult: {
      text: outputText,
      origin: 'fresh',
      decision: 'judged',
      voteWeight: 1,
      ballots: [],
      heardTranslators,
      candidateCount: heardTranslators,
      slate: [],
      perCandidate: [],
      findings: [],
    },
  } as unknown as TranslateSliceRecord;
}

/**
 * Two prepared slices, both of which the archive already translates.
 */
const CAT_SLICES = [
  pairOf({
    index: 0,
    target: 'The cat sleeps on the sill.',
  },),
  pairOf({
    index: 1,
    target: 'The bowl is full.',
  },),
];

await describe({
  name: translateLaneWordings.name,
  children: [
    it({
      name:
        'reports a slice whose stage heard NO TRANSLATOR as the archive standing by default rather than '
        + 'as a decision, because the record carries the incumbent as its output text and passing that '
        + 'through says the lane examined the passage and kept it, which is what a lost voice looks like '
        + 'when nothing separates the two',
      fn: async () => {
        /**
         * Wordings where the first slice was translated and the second was met
         * with silence.
         */
        const wordings = translateLaneWordings({
          slices: CAT_SLICES,
          unfilledChunkIndices: [],
          settled: [
            recordFor({
              chunkIndex: 0,
              outputText: 'The cat is asleep on the windowsill.',
              heardTranslators: 2,
            },),
            recordFor({
              chunkIndex: 1,
              outputText: 'The bowl is full.',
              heardTranslators: 0,
            },),
          ],
        },);
        expect(wordings,).toHaveLength(2,);
        expect(wordings[0]?.outcome,).toEqual({
          kind: 'decided',
          acceptedText: 'The cat is asleep on the windowsill.',
        },);

        // The unheard slice carries NO WORDING AT ALL. `incumbent-fallback`
        // has no accepted text by construction, so no consumer can read one
        // off it and call it a choice.
        expect(wordings[1]?.outcome,).toEqual({ kind: 'incumbent-fallback', },);
      },
    },),
    it({
      name:
        'still reports the archive wording for the unheard slice, on the incumbent side where it belongs, '
        + 'since that is what the assembled document carries there and a comparison needs it to say what '
        + 'stood',
      fn: async () => {
        /**
         * Wordings where nobody was heard for either slice.
         */
        const wordings = translateLaneWordings({
          slices: CAT_SLICES,
          unfilledChunkIndices: [],
          settled: [
            recordFor({
              chunkIndex: 0,
              outputText: 'The cat sleeps on the sill.',
              heardTranslators: 0,
            },),
            recordFor({
              chunkIndex: 1,
              outputText: 'The bowl is full.',
              heardTranslators: 0,
            },),
          ],
        },);
        expect(wordings.map(function toIncumbent(one,): string {
          return one.incumbentText;
        },),).toEqual([
          'The cat sleeps on the sill.',
          'The bowl is full.',
        ],);

        // READ OFF THE PREPARATION, not off the records: a resumed run can hold
        // cache values written under an earlier preparation of the same entry.
        expect(wordings.map(function toIncumbentKind(one,): string {
          return one.incumbentKind;
        },),).toEqual(['present', 'present',],);
      },
    },),
    it({
      name:
        'keeps an unfilled passage separate from an unheard one, because only one of them has anything to '
        + 'fall back on: the archive translates the unheard slice and has never translated the unfilled one',
      fn: async () => {
        /**
         * One translated slice and one place the archive leaves empty.
         */
        const anchored = [
          CAT_SLICES[0] ?? pairOf({
            index: 0,
            target: 'The cat sleeps on the sill.',
          },),
          {
            source: {
              chunkIndex: 1,
              nodes: [],
              startOffset: 0,
              endOffset: 0,
              text: 'source of the bowl',
            },
            target: makeInsertionChunk({
              chunkIndex: 1,
              offset: 0,
            },),
          },
        ];

        /**
         * Wordings where the heard slice went unheard and the anchor went
         * unfilled.
         */
        const wordings = translateLaneWordings({
          slices: anchored,
          unfilledChunkIndices: [1,],
          settled: [
            recordFor({
              chunkIndex: 0,
              outputText: 'The cat sleeps on the sill.',
              heardTranslators: 0,
            },),
          ],
        },);
        expect(wordings.map(function toOutcome(one,): string {
          return one.outcome
            .kind;
        },),).toEqual([
          'incumbent-fallback',
          'unfilled',
        ],);
        expect(wordings.map(function toIncumbentKind(one,): string {
          return one.incumbentKind;
        },),).toEqual(['present', 'absent',],);
      },
    },),
    it({
      name:
        'REFUSES a prepared slice no record and no unfilled index accounts for, since this lane visits every '
        + 'slice by contract and a gap it never named is a lost slice rather than an early stop',
      fn: async () => {
        /**
         * Failure the builder raised.
         */
        let caught: unknown;
        try {
          translateLaneWordings({
            slices: CAT_SLICES,
            unfilledChunkIndices: [],
            settled: [
              recordFor({
                chunkIndex: 0,
                outputText: 'The cat is asleep on the windowsill.',
                heardTranslators: 2,
              },),
            ],
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(LaneSliceCoverageError,);
        expect(String(caught,),).toContain('1',);
      },
    },),
  ],
},);
