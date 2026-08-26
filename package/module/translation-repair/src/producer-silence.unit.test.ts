/**
 * Tests for naming who a standing table leaves out.
 *
 * THE WHOLE POINT IS THE SPLIT. `producerStandings` carries a row only for a
 * model somebody voted on, and two very different things put a seated model
 * outside that set: a provider that refused it, and a slate where every peer
 * proposed the same wording so nothing was ever voted on. These cases pin that
 * the two stay apart, and that a table describing a roster the run never seated
 * is refused rather than reported.
 *
 * Fixtures are model ids and counts, so there is no passage here to invent. The
 * ids come from the catalog, since the roster is what this file is about.
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
  coverageGapLines,
  type ProducerStanding,
  readStandingCoverage,
  type RosterModelId,
  UnseatedStandingError,
} from '../dist/final/node/index.mjs';

/**
 * Model whose candidates drew ballots in every case that needs one.
 */
const JUDGED: RosterModelId = 'hf:moonshotai/Kimi-K3';

/**
 * Model that writes without ever being voted on.
 */
const UNVOTED: RosterModelId = 'hf:Qwen/Qwen3.8-27B';

/**
 * Model whose provider is out of budget, so it writes nothing.
 */
const ABSENT: RosterModelId = 'minimax-m3';

/**
 * Second silent model, so ordering can be checked on more than one.
 */
const ALSO_ABSENT: RosterModelId = 'gemma-4-26b-a4b-it';

/**
 * Model the roster dropped on 2026-08-24, which no run seats today.
 *
 * CAST ON PURPOSE, and this is the only cast here. `RosterModelId` is a closed
 * union of models a run may seat, so a departed id cannot be spelled inside it,
 * and refusing one is exactly what the two cases below check. A test that could
 * not name a departed model could not check the refusal at all.
 * `judge-fidelity.unit.test.ts` reaches for the same cast for the same reason.
 */
const DEPARTED = 'hf:zai-org/GLM-4.7-Flash' as unknown as RosterModelId;

/**
 * Seats every case starts from, in the order a report should preserve.
 */
const ROSTER: readonly RosterModelId[] = [
  JUDGED,
  UNVOTED,
  ABSENT,
  ALSO_ABSENT,
];

/**
 * Builds one standing row, since only its model id decides coverage.
 *
 * @param modelId - model the row is about
 *
 * @returns Row shaped as the tally produces them
 *
 * @example
 * ```ts
 * const standings = [standingOf({ modelId: JUDGED, },),];
 * ```
 */
function standingOf(
  { modelId, }: { readonly modelId: RosterModelId; },
): ProducerStanding {
  return {
    modelId,
    candidates: 3,
    disinterestedBallots: 9,
    disinterestedVotes: 4,
  };
}

await describe({
  name: readStandingCoverage.name,
  children: [
    it({
      name: 'splits a seated roster into judged, unvoted and silent',
      fn: async () => {
        /**
         * One model of each kind, so all three groups are non-empty at once.
         */
        const coverage = readStandingCoverage({
          roster: ROSTER,
          standings: [standingOf({ modelId: JUDGED, },),],
          produced: [
            JUDGED,
            UNVOTED,
          ],
        },);

        expect(coverage.judged,).toStrictEqual([JUDGED,],);
        expect(coverage.wroteUnjudged,).toStrictEqual([UNVOTED,],);
        expect(coverage.neverWrote,).toStrictEqual([
          ABSENT,
          ALSO_ABSENT,
        ],);
      },
    },),

    it({
      name: 'keeps roster order rather than the order evidence arrived in',
      fn: async () => {
        /**
         * Silent models, listed in the order the seats were filled even though
         * nothing about them was produced in that order.
         */
        const { neverWrote, } = readStandingCoverage({
          roster: ROSTER,
          standings: [standingOf({ modelId: JUDGED, },),],
          produced: [UNVOTED,],
        },);

        expect(neverWrote,).toStrictEqual([
          ABSENT,
          ALSO_ABSENT,
        ],);
      },
    },),

    it({
      name: 'counts a model that wrote AND was judged once, as judged',
      fn: async () => {
        /**
         * Coverage where the same model appears in both inputs, which is the
         * ordinary case: everything judged was also written.
         */
        const coverage = readStandingCoverage({
          roster: ROSTER,
          standings: [standingOf({ modelId: JUDGED, },),],
          produced: [
            JUDGED,
            JUDGED,
          ],
        },);

        expect(coverage.judged,).toStrictEqual([JUDGED,],);
        expect(coverage.wroteUnjudged,).toStrictEqual([],);
      },
    },),

    it({
      name: 'ACCEPTS a run where every seated model was judged',
      fn: async () => {
        /**
         * Coverage with nothing missing, so both silent groups are empty.
         */
        const coverage = readStandingCoverage({
          roster: [JUDGED,],
          standings: [standingOf({ modelId: JUDGED, },),],
          produced: [JUDGED,],
        },);

        expect(coverage.wroteUnjudged,).toStrictEqual([],);
        expect(coverage.neverWrote,).toStrictEqual([],);
      },
    },),

    it({
      name: 'REFUSES a standing naming a model the run never seated',
      fn: async () => {
        /**
         * What the reader threw, held so the class and the id it names can be
         * asserted apart.
         */
        const refusal = caught(function readsAnotherRoster() {
          readStandingCoverage({
            roster: ROSTER,
            standings: [standingOf({ modelId: DEPARTED, },),],
            produced: [],
          },);
        },);

        expect(refusal,).toBeInstanceOf(UnseatedStandingError,);
        expect((refusal as Error).message,).toContain(DEPARTED,);
      },
    },),

    it({
      name: 'REFUSES a produced list naming a model the run never seated',
      fn: async () => {
        /**
         * Same refusal reached through the other input, since a slate naming an
         * unseated model is the same contradiction as a table doing it.
         */
        const refusal = caught(function readsAnotherSlate() {
          readStandingCoverage({
            roster: ROSTER,
            standings: [],
            produced: [DEPARTED,],
          },);
        },);

        expect(refusal,).toBeInstanceOf(UnseatedStandingError,);
        expect((refusal as Error).message,).toContain(DEPARTED,);
      },
    },),
  ],
},);

await describe({
  name: coverageGapLines.name,
  children: [
    it({
      name: 'says nothing when every seated model is on the table',
      fn: async () => {
        /**
         * Lines for a run with no gap at all, which must be none rather than a
         * note claiming completeness.
         */
        const lines = coverageGapLines({
          coverage: readStandingCoverage({
            roster: [JUDGED,],
            standings: [standingOf({ modelId: JUDGED, },),],
            produced: [JUDGED,],
          },),
        },);

        expect(lines,).toStrictEqual([],);
      },
    },),

    it({
      name: 'names the unvoted writers apart from the silent models',
      fn: async () => {
        /**
         * Lines for a run with both kinds of gap, which must be two distinct
         * lines rather than one absence.
         */
        const lines = coverageGapLines({
          coverage: readStandingCoverage({
            roster: ROSTER,
            standings: [standingOf({ modelId: JUDGED, },),],
            produced: [
              JUDGED,
              UNVOTED,
            ],
          },),
        },);

        expect(lines,).toHaveLength(2,);
        expect(lines[0],).toContain(UNVOTED,);
        expect(lines[0],).not.toContain(ABSENT,);
        expect(lines[1],).toContain(ABSENT,);
        expect(lines[1],).toContain(ALSO_ABSENT,);
        expect(lines[1],).not.toContain(UNVOTED,);
      },
    },),

    it({
      name: 'carries both denominators, so a narrowed table cannot read as a full one',
      fn: async () => {
        /**
         * Line about the silent models, which has to say how many seats the
         * table describes against how many the run filled.
         */
        const lines = coverageGapLines({
          coverage: readStandingCoverage({
            roster: ROSTER,
            standings: [standingOf({ modelId: JUDGED, },),],
            produced: [JUDGED,],
          },),
        },);

        expect(lines,).toHaveLength(1,);
        expect(lines[0],).toContain('covers 1 of 4 seats',);
      },
    },),

    it({
      name: 'POINTS AT THE SEAT LINES from the silent-seat sentence, since this line cannot tell a '
        + 'budget refusal from a timeout from a seat failing every call and the seat report can '
        + '(calibrate-1)',
      fn: async () => {
        /**
         * Line about the silent models, which has to say where the per-seat
         * counts are.
         */
        const lines = coverageGapLines({
          coverage: readStandingCoverage({
            roster: ROSTER,
            standings: [standingOf({ modelId: JUDGED, },),],
            produced: [JUDGED,],
          },),
        },);

        expect(lines[0],).toContain('the SEAT lines at the end of this command',);
      },
    },),
  ],
},);
