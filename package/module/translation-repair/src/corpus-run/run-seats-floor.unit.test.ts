/**
 * Tests for the writing-bench floor.
 *
 * THE FIFTEENTH CLASS, the owner's decision of 2026-09-08: the eighth
 * hakureico pass on Bedrock alone settled a page one translator wrote and
 * three judges chose, with no editor or refiner reachable, as `SETTLED`. A
 * writing bench below the pair a slate needs, with no provider naming its
 * return, stops the entry for a pass that has the bench.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  benchesOf,
  type BudgetView,
  judgeSeatsFor,
  phaseBenches,
  reachableSeats,
  RUN_MODELS,
  RUN_TRANSLATORS,
  unreachableWritingBenches,
  WRITING_BENCH_FLOOR,
  WRITING_BENCHES,
  WritingBenchUnreachableError,
} from '../../dist/final/node/index.mjs';

//region Writing-bench floor tests

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
 * The eighth hakureico pass: Bedrock alone wet.
 */
const BEDROCK_ALONE: BudgetView = {
  synthetic: true,
  bedrock: false,
  hyper: true,
  openrouter: true,
};

await describe({
  name: unreachableWritingBenches.name,
  children: [
    it({
      name: 'NAMES NOTHING when every provider is wet, and NOTHING for a phase that leans on no writing '
        + 'bench however dry the providers, since judges short of quorum are the thirteenth class and not '
        + 'this one',
      fn: async () => {
        expect(unreachableWritingBenches({
          benches: benchesOf({ seats: judgeSeatsFor({ dry: ALL_WET, },), },),
          names: phaseBenches({ phase: 'lanes', },),
          dry: ALL_WET,
        },),).toEqual([],);
        expect(unreachableWritingBenches({
          benches: benchesOf({ seats: judgeSeatsFor({ dry: BEDROCK_ALONE, },), },),
          names: phaseBenches({ phase: 'consolidation', },),
          dry: BEDROCK_ALONE,
        },),).toEqual([],);
        expect(unreachableWritingBenches({
          benches: benchesOf({ seats: judgeSeatsFor({ dry: BEDROCK_ALONE, },), },),
          names: phaseBenches({ phase: 'pictures', },),
          dry: BEDROCK_ALONE,
        },),).toEqual([],);
      },
    },),
    it({
      name: 'NAMES each writing bench below the pair a slate needs, with the reachable count against the '
        + 'floor, in the order the phase lists them: the eighth hakureico pass at the lanes, no editor, '
        + 'no refiner and one translator reachable',
      fn: async () => {
        const benches = benchesOf({ seats: judgeSeatsFor({ dry: BEDROCK_ALONE, },), },);
        /**
         * Translators Bedrock serves under that view.
         */
        const translatorsReachable = reachableSeats({
          seats: RUN_TRANSLATORS,
          dry: BEDROCK_ALONE,
        },).length;
        expect(translatorsReachable,).toBeLessThan(WRITING_BENCH_FLOOR,);
        expect(reachableSeats({
          seats: RUN_MODELS.editorModelIds,
          dry: BEDROCK_ALONE,
        },),).toEqual([],);
        expect(unreachableWritingBenches({
          benches,
          names: phaseBenches({ phase: 'lanes', },),
          dry: BEDROCK_ALONE,
        },),).toEqual([
          `editors 0 of ${String(RUN_MODELS.editorModelIds.length,)} reachable, floor ${String(WRITING_BENCH_FLOOR,)}`,
          `refiners 0 of ${String((RUN_MODELS.refinerModelIds ?? []).length,)} reachable, floor ${String(WRITING_BENCH_FLOOR,)}`,
          `translators ${String(translatorsReachable,)} of ${String(RUN_TRANSLATORS.length,)} reachable, floor ${
            String(WRITING_BENCH_FLOOR,)
          }`,
        ],);
        expect(unreachableWritingBenches({
          benches,
          names: phaseBenches({ phase: 'translate lane', },),
          dry: BEDROCK_ALONE,
        },),).toEqual([
          `translators ${String(translatorsReachable,)} of ${String(RUN_TRANSLATORS.length,)} reachable, floor ${
            String(WRITING_BENCH_FLOOR,)
          }`,
        ],);
      },
    },),
    it({
      name: 'HOLDS THE FLOOR AT A PAIR on exactly the benches that write, so a judge bench never trips it '
        + 'and a bench of two reachable writers passes',
      fn: async () => {
        expect(WRITING_BENCH_FLOOR,).toBe(2,);
        expect([...WRITING_BENCHES,].toSorted(),).toEqual([
          'editors',
          'refiners',
          'translators',
        ],);
        const benches = benchesOf({ seats: judgeSeatsFor({ dry: BEDROCK_ALONE, },), },);
        /**
         * The translators bench with two Bedrock-served seats.
         */
        const pair = [
          'gemma-4-26b-a4b-it',
          'hf:openai/gpt-oss-120b',
        ] as const;
        expect(unreachableWritingBenches({
          benches: {
            ...benches,
            translators: pair,
          },
          names: ['translators',],
          dry: BEDROCK_ALONE,
        },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: WritingBenchUnreachableError.name,
  children: [
    it({
      name: 'NAMES the phase and every clause and nothing from a provider, so the tally can print it',
      fn: async () => {
        const error = new WritingBenchUnreachableError({
          phase: 'lanes',
          clauses: [
            'editors 0 of 3 reachable, floor 2',
            'translators 1 of 7 reachable, floor 2',
          ],
        },);
        expect(error.name,).toBe('WritingBenchUnreachableError',);
        expect(error.messageNamesOnly,).toBe(true,);
        expect(error.clauses.length,).toBe(2,);
        expect(error.message,).toBe(
          'writing bench unreachable at lanes: editors 0 of 3 reachable, floor 2; translators 1 of 7 reachable, '
            + 'floor 2; no provider has named its return, so the entry stops for a pass that has the bench',
        );
      },
    },),
  ],
},);

//endregion Writing-bench floor tests
