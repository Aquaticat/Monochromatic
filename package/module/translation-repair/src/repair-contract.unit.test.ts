/**
 * Tests for the producer-roster independence guard.
 *
 * `assertJudgeableProducerRoster` is what stops a model grading text it helped
 * write. Selection removes producers from the judge roster, so a roster that
 * looks large enough can leave too few disinterested judges once that removal
 * happens, and the stage would then be decided by a model with a stake in the
 * outcome.
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
  EditorRosterError,
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
const JUDGE_ONE = 'hf:Qwen/Qwen3.6-27B';

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
      name: 'REFUSES a roster one judge short of the minimum, which is the '
        + 'whole failure: a roster of three judges looks sufficient until '
        + 'selection removes the two that also produced candidates',
      fn: async () => {
        expect(function refuseOneShort() {
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
        },).toThrow(EditorRosterError,);
      },
    },),

    it({
      name: 'refuses when every judge also produced, leaving nobody '
        + 'disinterested at all',
      fn: async () => {
        expect(function refuseFullOverlap() {
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
        },).toThrow(EditorRosterError,);
      },
    },),

    it({
      name: 'counts DISTINCT disinterested judges, so one model listed twice '
        + 'is one voice: a duplicated judge id would otherwise satisfy the '
        + 'minimum with a single model deciding the stage, which is the exact '
        + 'outcome this guard exists to prevent',
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
        },).toThrow(EditorRosterError,);
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
        },).toThrow(EditorRosterError,);
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
        },).toThrow(EditorRosterError,);
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
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
            ],
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
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
            ],
            role: 'editor',
          },);
        },).toThrow(PRODUCER_ONE,);
      },
    },),

    it({
      name: 'requires enough DISINTERESTED judges to reach the minimum vote '
        + 'weight, since producers now judge at half weight and a candidate '
        + 'backed only by its own authors can never cross the line however '
        + 'many of them there are',
      fn: async () => {
        /**
         * Disinterested judges available to draw from, sliced against the
         * constant so this case follows the minimum if it ever moves.
         *
         * The threshold is a WEIGHT and this slice is a COUNT, which line up
         * exactly because a disinterested ballot carries weight one: reaching
         * weight two takes two of them, and no number of half-weight
         * self-votes substitutes.
         */
        const pool = [
          JUDGE_ONE,
          JUDGE_TWO,
          JUDGE_THREE,
        ] as const;

        expect(function refuseBelowMinimum() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [
              PRODUCER_ONE,
              ...pool.slice(
                0,
                MIN_SELECTION_WEIGHT - 1,
              ),
            ],
            role: 'editor',
          },);
        },).toThrow(EditorRosterError,);

        expect(function acceptAtMinimum() {
          assertJudgeableProducerRoster({
            producerModelIds: [PRODUCER_ONE,],
            judgeModelIds: [
              PRODUCER_ONE,
              ...pool.slice(
                0,
                MIN_SELECTION_WEIGHT,
              ),
            ],
            role: 'editor',
          },);
        },).not.toThrow();
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
            judgeModelIds: [
              PRODUCER_ONE,
              JUDGE_ONE,
            ],
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
