/**
 * Tests for one seat's rendered standing.
 *
 * THE REPORT IS LINES, NOT PRINTS, so these cases read it without capturing
 * the console. What they pin: a seat with no rounds says so instead of
 * rendering an empty table, a seat with rounds renders its standings and then
 * its coverage gaps with the answered-but-unslated state kept apart from the
 * silent one, and `judgedAuthors` names every stakeholder of every slate in
 * slate order, composites included.
 *
 * Fixtures are model ids and ballots, so there is no passage here to invent.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  judgedAuthors,
  type RosterModelId,
  type SelectionRound,
  sliceStandingLines,
  standingReportLines,
} from '../../dist/final/node/index.mjs';

//region Fixtures

/**
 * Model whose candidate a judge voted for, so it earns a row.
 */
const WRITER: RosterModelId = 'hf:moonshotai/Kimi-K3';

/**
 * Model that cast the ballot and, as a rewriter, was heard proposing nothing.
 */
const JUDGE: RosterModelId = 'hf:Qwen/Qwen3.8-27B';

/**
 * Model no answer came from.
 */
const IDLE: RosterModelId = 'minimax-m3';

/**
 * Second contributor of a composite candidate.
 */
const PARTNER: RosterModelId = 'gemma-4-26b-a4b-it';

/**
 * Seats the run filled, in the order the report should preserve.
 */
const ROSTER: readonly RosterModelId[] = [
  WRITER,
  JUDGE,
  IDLE,
];

/**
 * One judged round: a single candidate by the writer, voted for by the judge.
 */
const VOTED_ROUND: SelectionRound = {
  producers: [
    {
      kind: 'model',
      modelId: WRITER,
    },
  ],
  ballots: [
    {
      modelId: JUDGE,
      best: 1,
      reason: 'scripted',
      weight: 1,
      selfVote: false,
    },
  ],
};

/**
 * Round whose slate carries a composite candidate beside a plain one.
 */
const COMPOSITE_ROUND: SelectionRound = {
  producers: [
    {
      kind: 'composite',
      contributors: [
        WRITER,
        PARTNER,
      ],
    },
    {
      kind: 'model',
      modelId: JUDGE,
    },
  ],
  ballots: [],
};

//endregion Fixtures

await describe({
  name: standingReportLines.name,
  children: [
    it({
      name: 'renders a heading and the no-rounds note when nothing was judged',
      fn: async () => {
        /**
         * Report for a seat that judged nothing on either slice.
         */
        const lines = standingReportLines({
          seat: 'EDITOR',
          roster: ROSTER,
          perSlice: [
            [],
            [],
          ],
          produced: [],
          answered: { kind: 'unrecorded', },
        },);

        expect(lines,).toHaveLength(2,);
        expect(lines[0],).toBe('\nEDITOR standing over 0 judged rounds, from 0 of 2 slices',);
        expect(lines[1],).toContain('NO ROUNDS',);
      },
    },),

    it({
      name: 'renders the standings, then the answered-but-unslated seat, then the silent seat, '
        + 'each on its own line (#263)',
      fn: async () => {
        /**
         * Report for one voted round on the first of two slices, at a seat
         * that heard the writer and the judge and never the idle model.
         */
        const lines = standingReportLines({
          seat: 'REFINER',
          roster: ROSTER,
          perSlice: [
            [VOTED_ROUND,],
            [],
          ],
          produced: [WRITER,],
          answered: {
            kind: 'recorded',
            modelIds: [
              WRITER,
              JUDGE,
            ],
          },
        },);

        expect(lines[0],).toBe('\nREFINER standing over 1 judged rounds, from 1 of 2 slices',);
        expect(lines[1],).toContain(WRITER,);
        expect(lines[2],).toContain('ANSWERED AND WAS NEVER SLATED',);
        expect(lines[2],).toContain(JUDGE,);
        expect(lines[2],).not.toContain(IDLE,);
        expect(lines[3],).toContain('ANSWERED NOTHING USABLE',);
        expect(lines[3],).toContain(IDLE,);
        expect(lines[3],).not.toContain(JUDGE,);
        expect(lines.at(-1,),).toBe(`  slice 1: 1 rounds; ${WRITER} 1/1 over 1`,);
        expect(lines.slice(1, -1,).some(function isSliceLine(line,): boolean {
          return line.startsWith('  slice ',);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'ends with one counts line per slice that bought a round, in sample order, '
        + 'crediting every author of a composite and skipping slices that bought nothing',
      fn: async () => {
        /**
         * Per-slice lines for a voted slice, an empty slice, and a composite
         * slice nobody voted on.
         */
        const lines = sliceStandingLines({
          perSlice: [
            [VOTED_ROUND,],
            [],
            [COMPOSITE_ROUND,],
          ],
        },);

        expect(lines,).toStrictEqual([
          `  slice 1: 1 rounds; ${WRITER} 1/1 over 1`,
          `  slice 3: 1 rounds; ${WRITER} 0/0 over 1; ${PARTNER} 0/0 over 1; ${JUDGE} 0/0 over 1`,
        ],);
      },
    },),

    it({
      name: 'indents every line after the heading, so the report reads as one block under it',
      fn: async () => {
        /**
         * Report with a standing line and a coverage line to check the
         * indentation of.
         */
        const lines = standingReportLines({
          seat: 'EDITOR',
          roster: ROSTER,
          perSlice: [[VOTED_ROUND,],],
          produced: [WRITER,],
          answered: { kind: 'unrecorded', },
        },);

        for (const line of lines.slice(1,)) {
          expect(line.startsWith('  ',),).toBe(true,);
        }
      },
    },),
  ],
},);

await describe({
  name: judgedAuthors.name,
  children: [
    it({
      name: 'names every stakeholder of every slate in slate order, composites flattened',
      fn: async () => {
        /**
         * Authors across two slices, the second carrying a composite.
         */
        const authors = judgedAuthors({
          perSlice: [
            [VOTED_ROUND,],
            [COMPOSITE_ROUND,],
          ],
        },);

        expect(authors,).toStrictEqual([
          WRITER,
          WRITER,
          PARTNER,
          JUDGE,
        ],);
      },
    },),

    it({
      name: 'names nobody for slices that bought no round',
      fn: async () => {
        expect(judgedAuthors({
          perSlice: [
            [],
            [],
          ],
        },),).toStrictEqual([],);
      },
    },),
  ],
},);
