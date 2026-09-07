/**
 * Tests for the bench-quorum reading a phase takes before it starts.
 *
 * THE THIRTEENTH CLASS: on 2026-09-07 Hyper named its return in 538 s and was
 * held out for exactly that, Bedrock stayed wet, and so nothing waited. The
 * translate lane started with every Hyper-only writer refused in the same
 * millisecond, and every consolidation round read `quorum-not-met` at 0 ms.
 * A bench that cannot reach quorum among the seats a wet provider serves is
 * the phase-level twin of the all-dry case the router already waits on.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BudgetView,
  judgeSeatsFor,
  phaseBenches,
  reachableSeats,
  rosterQuorumSize,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  shortBenches,
} from '../../dist/final/node/index.mjs';

//region Bench quorum tests

/**
 * Every provider wet.
 */
const ALL_WET: BudgetView = {
  synthetic: false,
  bedrock: false,
  hyper: false,
  openrouter: false,
};

/**
 * The third hakureico pass at 22:00 UTC: Synthetic's week spent, Hyper held
 * out by its daily limit, OpenRouter at 0.01 USD, Bedrock alone wet.
 */
const BEDROCK_ALONE: BudgetView = {
  synthetic: true,
  bedrock: false,
  hyper: true,
  openrouter: true,
};

/**
 * Benches as the seat reader derives them from one view.
 *
 * @param dry - dryness per provider
 *
 * @returns Benches keyed by the names the phase table uses
 *
 * @example
 * ```ts
 * const benches = benchesUnder({ dry: ALL_WET, },);
 * ```
 */
function benchesUnder(
  { dry, }: { readonly dry: BudgetView; },
) {
  const seats = judgeSeatsFor({ dry, },);
  return {
    wide: seats.wideSeats,
    select: seats.selectJudges,
    slate: seats.slateJudges,
    translators: seats.translators,
    readers: seats.readers,
  };
}

await describe({
  name: reachableSeats.name,
  children: [
    it({
      name: 'KEEPS every seat when every provider is wet, and ONLY the seats Bedrock serves when it is '
        + 'the one wet provider',
      fn: async () => {
        expect(reachableSeats({
          seats: RUN_WIDE_SEATS,
          dry: ALL_WET,
        },),).toEqual(RUN_WIDE_SEATS,);
        const alone = reachableSeats({
          seats: RUN_WIDE_SEATS,
          dry: BEDROCK_ALONE,
        },);
        expect(alone.length,).toBeLessThan(RUN_WIDE_SEATS.length,);
        expect(alone.includes('gemma-4-26b-a4b-it',),).toBe(true,);
        expect(alone.includes('hf:openai/gpt-oss-120b',),).toBe(true,);
        expect(alone.includes('deepseek-v4-pro-0813',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: shortBenches.name,
  children: [
    it({
      name: 'NAMES NOTHING when every bench can reach quorum',
      fn: async () => {
        expect(shortBenches({
          benches: benchesUnder({ dry: ALL_WET, },),
          names: phaseBenches({ phase: 'consolidation', },),
          dry: ALL_WET,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'NAMES each bench that cannot reach quorum among the seats a wet provider serves, with the '
        + 'reachable count against the quorum, in the order the phase lists them',
      fn: async () => {
        const clauses = shortBenches({
          benches: benchesUnder({ dry: BEDROCK_ALONE, },),
          names: phaseBenches({ phase: 'lanes', },),
          dry: BEDROCK_ALONE,
        },);
        /**
         * Wide seats Bedrock serves under that view.
         */
        const wideReachable = reachableSeats({
          seats: RUN_WIDE_SEATS,
          dry: BEDROCK_ALONE,
        },).length;
        /**
         * Writers Bedrock serves under that view.
         */
        const writersReachable = reachableSeats({
          seats: RUN_TRANSLATORS,
          dry: BEDROCK_ALONE,
        },).length;
        expect(wideReachable,).toBeLessThan(rosterQuorumSize({ rosterSize: RUN_WIDE_SEATS.length, },),);
        expect(writersReachable,).toBeLessThan(rosterQuorumSize({ rosterSize: RUN_TRANSLATORS.length, },),);
        expect(clauses,).toEqual([
          `wide ${String(wideReachable,)} of ${String(RUN_WIDE_SEATS.length,)} reachable, quorum ${
            String(rosterQuorumSize({ rosterSize: RUN_WIDE_SEATS.length, },),)
          }`,
          `translators ${String(writersReachable,)} of ${String(RUN_TRANSLATORS.length,)} reachable, quorum ${
            String(rosterQuorumSize({ rosterSize: RUN_TRANSLATORS.length, },),)
          }`,
        ],);
      },
    },),
    it({
      name: 'READS ONLY the benches the phase leans on, so a phase that reads no pictures never waits on '
        + 'the readers',
      fn: async () => {
        expect(phaseBenches({ phase: 'pictures', },),).toEqual(['readers',],);
        expect(phaseBenches({ phase: 'translate lane', },),).toEqual([
          'translators',
          'select',
        ],);
        expect(phaseBenches({ phase: 'consolidation', },).includes('readers',),).toBe(false,);
      },
    },),
  ],
},);

//endregion Bench quorum tests
