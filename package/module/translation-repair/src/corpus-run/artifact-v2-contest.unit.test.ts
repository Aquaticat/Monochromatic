/**
 * Tests for the contest record, at the level it is derived rather than through
 * a whole artifact.
 *
 * WHAT IS UNDER TEST is the split the stage does not make for itself: `neither`
 * means two unrelated things depending on how many voices were heard, and this
 * module is where they stop being one answer.
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
  type ArtifactComparisonRowV2,
  contestEligibleIndexes,
  describeContestSlice,
  type LaneContestBallot,
  type LaneContestOutcome,
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
 * Ballot backing the repair lane, with nothing found against either candidate.
 */
const FOR_REPAIR: LaneContestBallot = {
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
const FOR_TRANSLATE: LaneContestBallot = {
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
const FOR_NEITHER: LaneContestBallot = {
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
 * Builds an outcome the way the stage returns one.
 *
 * @param ballots - usable ballots
 *
 * @param choice - candidate the stage settled on
 *
 * @returns Outcome carrying those ballots
 *
 * @example
 * ```ts
 * const outcome = catOutcome({ ballots: [FOR_REPAIR,], choice: 'neither', },);
 * ```
 */
function catOutcome(
  {
    ballots,
    choice,
  }: {
    readonly ballots: readonly LaneContestBallot[];
    readonly choice: LaneContestOutcome['choice'];
  },
): LaneContestOutcome {
  return {
    choice,
    ballots,
    usable: ballots.length,
    findings: [],
  };
}

/**
 * Builds a comparison row carrying the two lane wordings a test needs.
 *
 * @param chunkIndex - slice this names
 *
 * @param repairText - wording the repair document carries
 *
 * @param translateText - wording the translate document carries
 *
 * @returns Row with the rest of its fields held constant
 *
 * @example
 * ```ts
 * const row = catRow({ chunkIndex: 0, repairText: REPAIR_NAP, translateText: TRANSLATE_NAP, },);
 * ```
 */
function catRow(
  {
    chunkIndex,
    repairText,
    translateText,
  }: {
    readonly chunkIndex: number;
    readonly repairText: string;
    readonly translateText: string;
  },
): ArtifactComparisonRowV2 {
  return {
    chunkIndex,
    incumbentKind: 'present',
    incumbentText: ARCHIVE_NAP,
    repairText,
    translateText,
    verdict: (repairText === translateText) ? 'both-agree' : 'both-differ',
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

await describe({
  name: describeContestSlice.name,
  children: [
    it({
      name:
        'RECORDS the lane enough voices backed, naming it rather than leaving a reader to count the '
        + 'ballots back up',
      fn: async () => {
        expect(describeContestSlice({
          chunkIndex: 3,
          outcome: catOutcome({
            ballots: [
              FOR_REPAIR,
              FOR_REPAIR,
              FOR_TRANSLATE,
            ],
            choice: 'repair',
          },),
        },),).toEqual({
          chunkIndex: 3,
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
        },);
      },
    },),
    it({
      name:
        'SEPARATES a roster that heard enough voices and backed neither lane from one that went '
        + 'unheard, since the stage answers `neither` for both and a reader counting refusals would '
        + 'otherwise be counting silence',
      fn: async () => {
        /**
         * Enough voices, none of them carrying a lane.
         */
        const settled = describeContestSlice({
          chunkIndex: 0,
          outcome: catOutcome({
            ballots: [
              FOR_NEITHER,
              FOR_NEITHER,
            ],
            choice: 'neither',
          },),
        },);

        /**
         * One voice, which cannot settle anything under the same rule.
         */
        const unheard = describeContestSlice({
          chunkIndex: 1,
          outcome: catOutcome({
            ballots: [FOR_REPAIR,],
            choice: 'neither',
          },),
        },);
        expect(settled.verdict,).toEqual({ kind: 'settled-neither', },);
        expect(unheard.verdict,).toEqual({ kind: 'quorum-not-met', },);
      },
    },),
    it({
      name:
        'KEEPS THE BALLOTS on a verdict that ships nothing, which is exactly where a reader asking '
        + 'why is looking',
      fn: async () => {
        expect(describeContestSlice({
          chunkIndex: 0,
          outcome: catOutcome({
            ballots: [
              FOR_NEITHER,
              FOR_NEITHER,
            ],
            choice: 'neither',
          },),
        },).ballots,).toEqual([
          FOR_NEITHER,
          FOR_NEITHER,
        ],);
      },
    },),
  ],
},);

await describe({
  name: contestEligibleIndexes.name,
  children: [
    it({
      name:
        'NAMES ONLY the slices whose two lane wordings differ, since a contest between two identical '
        + 'candidates has nothing to ask and no answer worth buying',
      fn: async () => {
        expect(contestEligibleIndexes({
          comparison: [
            catRow({
              chunkIndex: 0,
              repairText: REPAIR_NAP,
              translateText: TRANSLATE_NAP,
            },),
            catRow({
              chunkIndex: 1,
              repairText: ARCHIVE_NAP,
              translateText: ARCHIVE_NAP,
            },),
            catRow({
              chunkIndex: 2,
              repairText: REPAIR_NAP,
              translateText: ARCHIVE_NAP,
            },),
          ],
        },),).toEqual([
          0,
          2,
        ],);
      },
    },),
    it({
      name: 'NAMES NOTHING when the two documents agree everywhere, rather than naming every slice',
      fn: async () => {
        expect(contestEligibleIndexes({
          comparison: [
            catRow({
              chunkIndex: 0,
              repairText: ARCHIVE_NAP,
              translateText: ARCHIVE_NAP,
            },),
          ],
        },),).toEqual([],);
      },
    },),
  ],
},);
