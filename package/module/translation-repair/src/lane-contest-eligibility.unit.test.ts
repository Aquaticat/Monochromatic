/**
 * Tests syntax-bearing lane winner publication eligibility.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  applyLaneContestEligibility,
  describeInadmissibleLanes,
  frontMatterContestEligibility,
  LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,
  laneContestChoiceMayShip,
  laneContestChoiceVerdict,
  type LaneContestBallot,
  type LaneContestOutcome,
  settleEligibleLaneContestBallots,
} from '../dist/final/node/index.mjs';

/**
 * Source identity repeated as visible name and alias.
 */
const SOURCE = '---\nname: 猫猫\ninfo:\n  alias: 猫猫\n---\n';

/**
 * Archive retaining entry id beside translated alias.
 */
const ARCHIVE = '---\nname: CatEntry\ninfo:\n  alias: Maomao\n---\n';

/**
 * Syntax-valid translated identity.
 */
const TRANSLATED = '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n';

/**
 * Builds contest outcome with chosen lane.
 *
 * @param choice - lane panel selected
 *
 * @returns Quorum-complete synthetic outcome
 *
 * @example
 * ```ts
 * const outcome = outcomeFor({ choice: 'repair', });
 * ```
 */
function outcomeFor(
  { choice, ballots = [], }: {
    readonly choice: LaneContestOutcome['choice'];
    readonly ballots?: readonly LaneContestBallot[];
  },
): LaneContestOutcome {
  /**
   * Raw ballots fixture outcome retains.
   */
  const usable = ballots.length === 0 ? 2 : ballots.length;
  return {
    choice,
    ballots,
    usable,
    findings: [],
  };
}

/**
 * Builds raw contest ballot choosing one lane.
 *
 * @param choice - unmodified model choice
 *
 * @returns Complete ballot fixture
 *
 * @example
 * ```ts
 * const ballot = ballotFor({ choice: 'translate', });
 * ```
 */
function ballotFor(
  { choice, }: { readonly choice: LaneContestBallot['choice']; },
): LaneContestBallot {
  return {
    choice,
    unsupported: [],
    unsupportedRaw: [],
    dropped: [],
    droppedRaw: [],
    reason: 'fixture reads one candidate as source-faithful',
  };
}

await describe({
  name: settleEligibleLaneContestBallots.name,
  children: [
    it({
      name: 'EXCLUDES INVALID LANE VOTES without redirecting them to eligible lane',
      fn: async () => {
        const eligibility = frontMatterContestEligibility({
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
        },);
        const ballots = [
          ballotFor({ choice: 'repair', },),
          ballotFor({ choice: 'repair', },),
          ballotFor({ choice: 'translate', },),
          ballotFor({ choice: 'translate', },),
        ];
        expect(settleEligibleLaneContestBallots({
          ballots,
          eligibility,
        },),).toBe('translate',);
        const admitted = applyLaneContestEligibility({
          outcome: outcomeFor({ choice: 'neither', ballots, },),
          eligibility,
        },);
        expect(admitted.choice,).toBe('translate',);
        expect(admitted.ballots,).toEqual(ballots,);
      },
    },),

    it({
      name: 'RETURNS NEITHER when eligible lane lacks direct quorum',
      fn: async () => {
        const eligibility = frontMatterContestEligibility({
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
        },);
        expect(settleEligibleLaneContestBallots({
          ballots: [
            ballotFor({ choice: 'repair', },),
            ballotFor({ choice: 'repair', },),
            ballotFor({ choice: 'translate', },),
          ],
          eligibility,
        },),).toBe('neither',);
      },
    },),
  ],
},);

await describe({
  name: laneContestChoiceMayShip.name,
  children: [
    it({
      name: 'REFUSES FRONT MATTER winner retaining directory id',
      fn: async () => {
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'repair', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toBe(false,);
      },
    },),

    it({
      name: 'ACCEPTS FRONT MATTER winner preserving source identity relation',
      fn: async () => {
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'translate', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES ORDINARY REPAIR-LANE WINNER that respells target contributor authority',
      fn: async () => {
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'repair', },),
          sourceText: '本条目贡献者：雪猫',
          incumbentText: 'Contributors for this entry: [Snow](https://example.test/snow)',
          repairText: 'Contributors for this entry: Snowflake',
          translateText: 'Contributors for this entry: [Snow](https://example.test/snow)',
        },),).toBe(false,);
      },
    },),

    it({
      name: 'LEAVES ORDINARY PROSE AND DECLINED CONTEST outside syntax rejection',
      fn: async () => {
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'repair', },),
          sourceText: '猫。',
          incumbentText: 'Cat.',
          repairText: 'Cat.',
          translateText: 'A cat.',
        },),).toBe(true,);
        expect(laneContestChoiceMayShip({
          outcome: outcomeFor({ choice: 'neither', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: laneContestChoiceVerdict.name,
  children: [
    it({
      name: 'CARRIES THE FINDINGS behind a refusal, and agrees with the boolean',
      fn: async () => {
        /**
         * Verdict on a front matter winner that retains the directory id.
         */
        const verdict = laneContestChoiceVerdict({
          outcome: outcomeFor({ choice: 'repair', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },);
        expect(verdict.mayShip,).toBe(false,);
        expect(verdict.findings.length > 0,).toBe(true,);
        expect(verdict.findings.join(' ',),).toContain('name',);
      },
    },),

    it({
      name: 'CARRIES NO FINDINGS on a pass',
      fn: async () => {
        expect(laneContestChoiceVerdict({
          outcome: outcomeFor({ choice: 'translate', },),
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toEqual({
          mayShip: true,
          findings: [],
        },);
      },
    },),

    it({
      name: 'NAMES EACH EXCLUDED LANE AND ITS FINDING for the log, since the floor finding alone says '
        + 'nothing about why (Uekawakuyuurei, 2026-09-04: the translate lane restored a location field the '
        + 'archive had dropped, and the reason lived only in the slice cache)',
      fn: async () => {
        /**
         * Translate offer restoring a field the archive does not carry.
         */
        const restored = '---\nname: Maomao\ninfo:\n  alias: Maomao\n  location: Catford\n---\n';

        /**
         * What the log gets for an archive breaking the identity rule beside
         * a repair keeping it and a translate reshaping it.
         */
        const lines = describeInadmissibleLanes({
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: TRANSLATED,
          translateText: restored,
        },);

        expect(lines.length,).toBe(2,);
        expect(lines[0],).toContain('archive inadmissible: Your translation must carry the name',);
        expect(lines[1],).toContain('translate inadmissible: Your translation changed YAML field names',);
        expect(describeInadmissibleLanes({
          sourceText: SOURCE,
          incumbentText: TRANSLATED,
          repairText: TRANSLATED,
          translateText: TRANSLATED,
        },),).toStrictEqual([],);
      },
    },),
    it({
      name: 'NAMES THE FLOOR FINDING when a syntax decline stood for an empty eligible slate',
      fn: async () => {
        expect(laneContestChoiceVerdict({
          outcome: {
            ...outcomeFor({ choice: 'neither', },),
            findings: [LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,],
          },
          sourceText: SOURCE,
          incumbentText: ARCHIVE,
          repairText: ARCHIVE,
          translateText: TRANSLATED,
          syntax: 'front-matter',
        },),).toEqual({
          mayShip: false,
          findings: [LANE_CONTEST_ELIGIBILITY_FLOOR_FINDING,],
        },);
        expect(laneContestChoiceVerdict({
          outcome: outcomeFor({ choice: 'neither', },),
          sourceText: '猫。',
          incumbentText: 'Cat.',
          repairText: 'Cat.',
          translateText: 'A cat.',
        },),).toEqual({
          mayShip: true,
          findings: [],
        },);
      },
    },),
  ],
},);
