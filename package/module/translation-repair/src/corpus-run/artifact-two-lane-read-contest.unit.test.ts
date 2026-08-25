/**
 * Tests for reading a recorded contest back out of a settled artifact.
 *
 * WHAT IS UNDER TEST is what the reader refuses. A recorded verdict is a claim
 * about ballots stored beside it and a recorded contest is a claim about which
 * slices the two lanes worded differently, so both are re-derived here and a
 * disagreement is an error rather than a reading.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  caught,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
type ArtifactComparisonRow,
  ArtifactParseError,
  SLICE_SPELLED_KEYS,
  parseLaneSelection,
} from '../../dist/final/node/index.mjs';

/**
 * Archive`s own English for the slice every fixture here describes.
 */
const ARCHIVE_NAP = 'The cat sleeps in the bookshop attic.';

/**
 * Wording the repair lane left.
 */
const REPAIR_NAP = 'The cat naps in the bookshop attic.';

/**
 * Wording the translate lane left, differing from both.
 */
const TRANSLATE_NAP = 'The cat dozes in the attic of the bookshop.';

/**
 * Path every message under test is built against.
 */
const SELECTION_PATH = 'CatEntry1.laneSelection';

/**
 * Ballot backing the repair lane, in the recorded rather than the typed form.
 */
const FOR_REPAIR = {
  choice: 'repair',
  unsupported: [],
  unsupportedRaw: [],
  dropped: [],
  droppedRaw: [],
  reason: 'keeps the bookshop, which the original names',
};

/**
 * Ballot backing the translate lane.
 */
const FOR_TRANSLATE = {
  choice: 'translate',
  unsupported: [],
  unsupportedRaw: [],
  dropped: [],
  droppedRaw: [],
  reason: 'reads more naturally and says the same thing',
};

/**
 * Ballot backing neither, which is a reading rather than a silence.
 */
const FOR_NEITHER = {
  choice: 'neither',
  unsupported: [
    'repair',
    'translate',
  ],
  unsupportedRaw: ['both add an attic the original does not mention',],
  dropped: [],
  droppedRaw: [],
  reason: 'both candidates invent a detail',
};

/**
 * Builds a comparison row carrying the two lane wordings a test needs.
 *
 * @param sliceIndex - slice this names
 *
 * @param repairText - wording the repair document carries
 *
 * @param translateText - wording the translate document carries
 *
 * @returns Row with the rest of its fields held constant
 *
 * @example
 * ```ts
 * const row = catRow({ sliceIndex: 0, repairText: REPAIR_NAP, translateText: TRANSLATE_NAP, },);
 * ```
 */
function catRow(
  {
    sliceIndex,
    repairText,
    translateText,
  }: {
    readonly sliceIndex: number;
    readonly repairText: string;
    readonly translateText: string;
  },
): ArtifactComparisonRow {
  return {
    sliceIndex,
    incumbentKind: 'present',
    incumbentText: ARCHIVE_NAP,
    repairText,
    translateText,
    laneRelation: (repairText === translateText) ? 'both-agree' : 'both-differ',
    repairOutcome: {
      kind: 'decided',
      acceptedText: repairText,
    },
    translateOutcome: {
      kind: 'decided',
      acceptedText: translateText,
    },
    decisionComparison: {
      kind: 'comparable',
      verdict: (repairText === translateText) ? 'same' : 'different',
    },
    repairDelivery: { kind: 'replacement-shipped', },
    translateDelivery: { kind: 'replacement-shipped', },
  };
}

/**
 * Slice both lanes worded differently, which a contest may answer.
 */
const CONTESTED_ROW = catRow({
  sliceIndex: 0,
  repairText: REPAIR_NAP,
  translateText: TRANSLATE_NAP,
},);

/**
 * Comparison where slice 0 and slice 2 are worded differently by the two lanes
 * and slice 1 is not, so eligibility is neither every slice nor none of them.
 */
const MIXED: readonly ArtifactComparisonRow[] = [
  CONTESTED_ROW,
  catRow({
    sliceIndex: 1,
    repairText: ARCHIVE_NAP,
    translateText: ARCHIVE_NAP,
  },),
  catRow({
    sliceIndex: 2,
    repairText: REPAIR_NAP,
    translateText: ARCHIVE_NAP,
  },),
];

/**
 * Comparison whose one slice the two lanes worded differently.
 */
const ONE_CONTESTED: readonly ArtifactComparisonRow[] = [CONTESTED_ROW,];

await describe({
  name: parseLaneSelection.name,
  children: [
    it({
      name:
        'ACCEPTS the pending kind, which every artifact settled before the contest existed carries '
        + 'and which stays legal for exactly that reason',
      fn: async () => {
        expect(parseLaneSelection({
          value: { kind: 'pending-human-decision', },
          comparison: MIXED,
          path: SELECTION_PATH,
          keys: SLICE_SPELLED_KEYS,
        },),).toEqual({ kind: 'pending-human-decision', },);
      },
    },),
    it({
      name:
        'ACCEPTS a contest answering every eligible slice, carrying a win, a settled refusal and an '
        + 'unheard roster side by side',
      fn: async () => {
        /**
         * Selection the reader returned, narrowed before its slices are read.
         */
        const selection = parseLaneSelection({
          value: {
            kind: 'contested',
            slices: [
              {
                sliceIndex: 0,
                verdict: {
                  kind: 'lane-won',
                  lane: 'repair',
                },
                ballots: [
                  FOR_REPAIR,
                  FOR_REPAIR,
                  FOR_TRANSLATE,
                ],
                usable: 3,
              },
              {
                sliceIndex: 2,
                verdict: { kind: 'settled-neither', },
                ballots: [
                  FOR_NEITHER,
                  FOR_NEITHER,
                ],
                usable: 2,
              },
            ],
          },
          comparison: MIXED,
          path: SELECTION_PATH,
          keys: SLICE_SPELLED_KEYS,
        },);
        if (selection.kind !== 'contested')
          throw new Error('reader returned a pending selection for a contested one',);
        expect(selection.slices
          .map(function nameVerdict(slice,): string {
            return slice.verdict
              .kind;
          },),).toEqual([
          'lane-won',
          'settled-neither',
        ],);
      },
    },),
    it({
      name: 'ACCEPTS a slice too few of whose voices arrived, recording it as unsettled rather than as a refusal',
      fn: async () => {
        /**
         * Selection the reader returned, narrowed before its slices are read.
         */
        const selection = parseLaneSelection({
          value: {
            kind: 'contested',
            slices: [
              {
                sliceIndex: 0,
                verdict: { kind: 'quorum-not-met', },
                ballots: [FOR_REPAIR,],
                usable: 1,
              },
            ],
          },
          comparison: ONE_CONTESTED,
          path: SELECTION_PATH,
          keys: SLICE_SPELLED_KEYS,
        },);
        if (selection.kind !== 'contested')
          throw new Error('reader returned a pending selection for a contested one',);
        expect(selection.slices
          .at(0,)
          ?.verdict,).toEqual({ kind: 'quorum-not-met', },);
      },
    },),
    it({
      name:
        'ROUND-TRIPS an ARCHIVE VERDICT on a ballot, and gives a ballot carrying none back with NO '
        + 'archive key rather than an undefined one: the archive is judged as its own question, so a '
        + 'ballot written before that question existed has to read as silent about it, and a key set '
        + 'to undefined is not silence to anything that asks whether the ballot answered',
      fn: async () => {
        /**
         * Selection whose one ballot judged the archive beside the two lanes.
         */
        const judged = parseLaneSelection({
          value: {
            kind: 'contested',
            slices: [
              {
                sliceIndex: 0,
                verdict: { kind: 'quorum-not-met', },
                ballots: [{
                  ...FOR_REPAIR,
                  archive: 'flawed',
                },],
                usable: 1,
              },
            ],
          },
          comparison: ONE_CONTESTED,
          path: SELECTION_PATH,
          keys: SLICE_SPELLED_KEYS,
        },);
        if (judged.kind !== 'contested')
          throw new Error('reader returned a pending selection for a contested one',);
        expect(judged.slices
          .at(0,)
          ?.ballots
          .at(0,)
          ?.archive,).toBe('flawed',);

        /**
         * Same selection with the ballot silent about the archive.
         */
        const silent = parseLaneSelection({
          value: {
            kind: 'contested',
            slices: [
              {
                sliceIndex: 0,
                verdict: { kind: 'quorum-not-met', },
                ballots: [FOR_REPAIR,],
                usable: 1,
              },
            ],
          },
          comparison: ONE_CONTESTED,
          path: SELECTION_PATH,
          keys: SLICE_SPELLED_KEYS,
        },);
        if (silent.kind !== 'contested')
          throw new Error('reader returned a pending selection for a contested one',);

        /**
         * Ballot the reader gave back, whose KEYS are what this half reads.
         */
        const ballot = silent.slices
          .at(0,)
          ?.ballots
          .at(0,);
        if (ballot === undefined)
          throw new Error('reader gave back a slice with no ballots',);
        expect(Object.hasOwn(
          ballot,
          'archive',
        ),).toBe(false,);
      },
    },),
    it({
      name:
        'REFUSES an archive verdict this version does not describe, which the lane choice beside it '
        + 'cannot catch: the two fields are read against different lists, and a judge answering the '
        + 'archive question with a lane name would otherwise be recorded as having judged it',
      fn: async () => {
        /**
         * What archiveVerdictUnknown raised, read for its class as well as its wording.
         */
        const refusalOfArchiveVerdictUnknown = caught(function archiveVerdictUnknown() {
          parseLaneSelection({
            value: {
              kind: 'contested',
              slices: [
                {
                  sliceIndex: 0,
                  verdict: { kind: 'quorum-not-met', },
                  ballots: [{
                    ...FOR_REPAIR,
                    archive: 'repair',
                  },],
                  usable: 1,
                },
              ],
            },
            comparison: ONE_CONTESTED,
            path: SELECTION_PATH,
            keys: SLICE_SPELLED_KEYS,
          },);
        },);

        expect(refusalOfArchiveVerdictUnknown,).toBeInstanceOf(ArtifactParseError,);
        expect((refusalOfArchiveVerdictUnknown as Error).message,).toContain('one of publishable, flawed',);
      },
    },),
    it({
      name: 'REFUSES a kind this version does not describe, rather than reading it as pending',
      fn: async () => {
        /**
         * What parseLaneSelection raised, read for its class as well as its wording.
         */
        const refusalOfParseLaneSelection = caught(() => {
          parseLaneSelection({
            value: { kind: 'shipped-repair', },
            comparison: MIXED,
            path: SELECTION_PATH,
            keys: SLICE_SPELLED_KEYS,
          },);
        },);

        expect(refusalOfParseLaneSelection,).toBeInstanceOf(ArtifactParseError,);
        expect((refusalOfParseLaneSelection as Error).message,).toContain('CatEntry1.laneSelection.kind',);
      },
    },),
    it({
      name:
        'REFUSES a field beside the pending kind, since a pending selection carrying a decision is '
        + 'two answers at once',
      fn: async () => {
        expect(() => {
          parseLaneSelection({
            value: {
              kind: 'pending-human-decision',
              slices: [],
            },
            comparison: MIXED,
            path: SELECTION_PATH,
            keys: SLICE_SPELLED_KEYS,
          },);
        },).toThrow(SELECTION_PATH,);
      },
    },),
  ],
},);
