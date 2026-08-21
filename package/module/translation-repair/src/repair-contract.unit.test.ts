/**
 * Tests for the producer-roster independence guard.
 *
 * `assertJudgeableProducerRoster` refuses a roster that could not decide a
 * round however its judges voted, and NOTHING ELSE. By the user ruling of
 * 2026-08-14 self-judging is allowed at reduced weight, so a roster where every
 * model both produces and judges is legal; what is not legal is a roster too
 * small to reach the minimum selection weight, since one judge contributes at
 * most one full-weight ballot.
 *
 * The cases that used to assert an independence requirement are inverted here
 * on purpose: they now assert that the same rosters are ACCEPTED. An earlier
 * version of this file recorded the opposite policy, and reading them side by
 * side is the clearest statement of what changed.
 *
 * `assertJudgeableEditorRoster` delegates here and is covered through the
 * editor ensemble, so the arithmetic branches already run. What was never
 * exercised is the `role` parameter and the second caller that uses it: the
 * naturalness lane passes `refiner`, and if `role` were ever dropped a refiner
 * roster failure would report itself as an editor failure and send whoever
 * reads it to the wrong configuration.
 *
 * Model ids are real catalog entries because `SyntheticModelId` is a closed
 * union.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertJudgeableEditorRoster,
  assertJudgeableProducerRoster,
  ProducerRosterError,
  FULL_VOTE_WEIGHT,
  MIN_SELECTION_WEIGHT,
} from '../dist/final/node/index.mjs';

/**
 * Model that produces candidates in most cases below.
 */
const PRODUCER_ONE = 'hf:zai-org/GLM-5.2';

/**
 * Second producer, for repeat and overlap cases.
 */
const PRODUCER_TWO = 'hf:moonshotai/Kimi-K3';

/**
 * Judge with no stake in either producer's output.
 */
const JUDGE_ONE = 'hf:Qwen/Qwen3.8-27B';

/**
 * Second disinterested judge, so a roster can meet the vote minimum.
 */
const JUDGE_TWO = 'hf:openai/gpt-oss-120b';

/**
 * Third disinterested judge, for rosters that must exceed the minimum.
 */
const JUDGE_THREE = 'hf:zai-org/GLM-4.7-Flash';

await describe({
  name: assertJudgeableProducerRoster.name,
  children: [
    it({
      name: 'accepts a roster leaving exactly the minimum disinterested '
        + 'judges, since the minimum is a floor rather than something to '
        + 'exceed',
      fn: async () => {
        expect(function acceptMinimum() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
              JUDGE_TWO,
            ],
            role: 'editor',
          },);
        },).not.toThrow();
      },
    },),

    it({
      name: 'ACCEPTS a roster whose judges are mostly producers, which the '
        + 'old guard refused. This is the ruling of 2026-08-14 in one case: a '
        + 'model grading its own work is a discounted opinion, not a '
        + 'forbidden one, so a provider degraded for the day cannot make a '
        + 'legal roster illegal',
      fn: async () => {
        expect(function acceptMostlyProducers() {
          assertJudgeableProducerRoster({
            producerModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
            ],
            judgeModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
              JUDGE_ONE,
            ],
            role: 'editor',
          },);
        },).not.toThrow();
      },
    },),

    it({
      name: 'ACCEPTS a roster where EVERY judge produced, which is the widest '
        + 'case the ruling allows and the one a full-roster bench needs. '
        + 'Nothing here says such a round will decide anything: if every judge '
        + 'backs its own candidate each draws half a vote and the incumbent '
        + 'survives, which is the weights doing the work this guard used to',
      fn: async () => {
        expect(function acceptFullOverlap() {
          assertJudgeableProducerRoster({
            producerModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
              JUDGE_ONE,
              JUDGE_TWO,
            ],
            judgeModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
              JUDGE_ONE,
              JUDGE_TWO,
            ],
            role: 'editor',
          },);
        },).not.toThrow();
      },
    },),

    it({
      name: 'accepts THREE authors judging only each other, because a candidate '
        + 'one of them wrote draws half a vote from its author and a full one '
        + 'from each of the other two. An earlier version of this guard measured '
        + 'the collapse case instead, treating all three as stakeholders in one '
        + 'candidate, and refused a bench that decides comfortably whenever they '
        + 'disagree',
      fn: async () => {
        expect(function acceptThreeAuthors() {
          assertJudgeableProducerRoster({
            producerModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
              JUDGE_ONE,
            ],
            judgeModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
              JUDGE_ONE,
            ],
            role: 'editor',
          },);
        },).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES two authors judging only each other, which is where full '
        + 'overlap actually stops working: whichever of them wrote a candidate '
        + 'is discounted on it, so the best any candidate can draw is one and a '
        + 'half votes and no round can ever reach the minimum',
      fn: async () => {
        expect(function refuseTwoAuthors() {
          assertJudgeableProducerRoster({
            producerModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
            ],
            judgeModelIds: [
              PRODUCER_ONE,
              PRODUCER_TWO,
            ],
            role: 'editor',
          },);
        },).toThrow(ProducerRosterError,);
      },
    },),

    it({
      name: 'counts DISTINCT judges, so one model listed twice is one voice: '
        + 'a duplicated judge id would otherwise reach the minimum weight with '
        + 'a single model deciding the stage, which is the exact outcome this '
        + 'guard exists to prevent',
      fn: async () => {
        expect(function refuseDuplicatedJudge() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
              JUDGE_ONE,
            ],
            role: 'editor',
          },);
        },).toThrow(ProducerRosterError,);
      },
    },),

    it({
      name: 'refuses a producer roster with a repeat, since the same model '
        + 'twice is one voice pretending to be an ensemble',
      fn: async () => {
        expect(function refuseRepeatedProducer() {
          assertJudgeableProducerRoster({
            producerModelIds: [
              PRODUCER_ONE,
              PRODUCER_ONE,
            ],
            judgeModelIds: [
              JUDGE_ONE,
              JUDGE_TWO,
              JUDGE_THREE,
            ],
            role: 'editor',
          },);
        },).toThrow(ProducerRosterError,);
      },
    },),

    it({
      name: 'refuses an EMPTY producer roster, because a stage with no '
        + 'producers has nothing to judge and would otherwise pass on the '
        + 'technicality that no judge has a stake',
      fn: async () => {
        expect(function refuseEmptyProducers() {
          assertJudgeableProducerRoster({
            producerModelIds: [],
            judgeModelIds: [
              JUDGE_ONE,
              JUDGE_TWO,
              JUDGE_THREE,
            ],
            role: 'editor',
          },);
        },).toThrow(ProducerRosterError,);
      },
    },),

    it({
      name: 'NAMES THE ROLE in the failure, so the naturalness lane reports a '
        + 'refiner roster rather than an editor one and whoever reads it opens '
        + 'the right configuration',
      fn: async () => {
        expect(function refuseRefinerRoster() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [JUDGE_ONE,],
            role: 'refiner',
          },);
        },).toThrow('refiner',);
      },
    },),

    it({
      name: 'names both rosters in the failure, so the message is actionable '
        + 'without reopening the run configuration to find out who was on them',
      fn: async () => {
        expect(function refuseAndReport() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [JUDGE_ONE,],
            role: 'editor',
          },);
        },).toThrow(PRODUCER_ONE,);
      },
    },),

    it({
      name: 'seats judges by the MINIMUM WEIGHT rather than by a written '
        + 'count, and refuses one seat below it. One judge can contribute at '
        + 'most one full-weight ballot, so a roster below that floor declines '
        + 'every round while looking like a pipeline that simply found '
        + 'nothing to change',
      fn: async () => {
        /**
         * Judges available to draw from, sliced against the constants so this
         * case follows the floor if either weight ever moves.
         */
        const pool = [
          JUDGE_ONE,
          JUDGE_TWO,
          JUDGE_THREE,
        ] as const;

        /**
         * Seats the weights require, derived exactly as the guard derives them.
         */
        const seats = Math.ceil(MIN_SELECTION_WEIGHT / FULL_VOTE_WEIGHT,);

        expect(function refuseBelowSeats() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: pool.slice(
              0,
              seats - 1,
            ),
            role: 'editor',
          },);
        },).toThrow(ProducerRosterError,);

        expect(function acceptAtSeats() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: pool.slice(
              0,
              seats,
            ),
            role: 'editor',
          },);
        },).not.toThrow();
      },
    },),

    it({
      name: 'REFUSES one producer judged by itself and one other model, which '
        + 'counting seats would have passed. That bench tops out at half a '
        + 'vote from the author plus one from the other judge, so nothing can '
        + 'ever reach a minimum of two and every round would decline while '
        + 'reading as a stage that found nothing worth changing',
      fn: async () => {
        expect(function refuseUnwinnableBench() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
            ],
            role: 'editor',
          },);
        },).toThrow(ProducerRosterError,);
      },
    },),

    it({
      name: 'names the CAPACITY in that refusal, since the remedy differs by '
        + 'fault: a roster short of weight needs another judge, while a '
        + 'repeated id needs one removed, and a message covering both sends '
        + 'whoever reads it to the wrong configuration',
      fn: async () => {
        expect(function refuseAndSayWhy() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
            ],
            role: 'editor',
          },);
        },).toThrow('at most 1.5',);
      },
    },),
  ],
},);

await describe({
  name: assertJudgeableEditorRoster.name,
  children: [
    it({
      name: 'reports itself as the EDITOR roster, which is what makes the '
        + 'shared guard readable at two call sites: the same arithmetic fails '
        + 'under two different names',
      fn: async () => {
        expect(function refuseEditorRoster() {
          assertJudgeableEditorRoster({
            editorModelIds: [PRODUCER_ONE,],
            judgeModelIds: [JUDGE_ONE,],
          },);
        },).toThrow('editor',);
      },
    },),

    it({
      name: 'accepts the same roster the shared guard accepts, so delegation '
        + 'has not narrowed what the editor stage allows',
      fn: async () => {
        expect(function acceptEditorRoster() {
          assertJudgeableEditorRoster({
            editorModelIds: [PRODUCER_ONE,],
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
              JUDGE_TWO,
            ],
          },);
        },).not.toThrow();
      },
    },),
  ],
},);
