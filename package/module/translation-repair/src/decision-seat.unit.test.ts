/**
 Guards the decision-only seat (owner, 2026-09-18: `typesafe/jev-1.13`
 approved on OpenRouter): a model served by OpenRouter's decisions endpoint
 alone sits on the roster with no chat reach, so no chat catalog, cap or
 bench ever asks it for a completion, and it reaches the select judges only
 through its own list once the judge fidelity probe seats it. Cat-themed
 invention where any text is needed; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  cardOf,
  DECISION_ONLY_ROSTER_IDS,
  isDecisionSeat,
  judgeSeatsFor,
  OPENROUTER_DECISION_IDS,
  reachOf,
  readsImages,
  ROSTER_MODEL_IDS,
  RUN_DECISION_JUDGES,
  RUN_LATE_JUDGES,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_SELECT_JUDGES,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  RUN_WRITERS,
  SEAT_OPENROUTER_DECISIONS,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'a decision-only seat',
  children: [
    it({
      name: 'IS ON THE ROSTER with a decisions side, no chat reach, no pictures and the three unmeasured holds',
      fn: async () => {
        expect(ROSTER_MODEL_IDS.includes(SEAT_OPENROUTER_DECISIONS,),).toBe(true,);
        expect([...DECISION_ONLY_ROSTER_IDS,],).toEqual([SEAT_OPENROUTER_DECISIONS,],);
        expect([...OPENROUTER_DECISION_IDS,],).toEqual([SEAT_OPENROUTER_DECISIONS,],);
        expect(isDecisionSeat({ modelId: SEAT_OPENROUTER_DECISIONS, },),).toBe(true,);
        expect(isDecisionSeat({ modelId: 'minimax-m3', },),).toBe(false,);
        expect(reachOf({ modelId: SEAT_OPENROUTER_DECISIONS, },),).toEqual({
          synthetic: false,
          hyper: false,
          bedrock: false,
          openrouter: false,
        },);
        expect(readsImages({ modelId: SEAT_OPENROUTER_DECISIONS, },),).toBe(false,);
        /**
         Card of the seat.
         */
        const card = cardOf({ modelId: SEAT_OPENROUTER_DECISIONS, },);
        expect(card.decisions?.id,).toBe(SEAT_OPENROUTER_DECISIONS,);
        expect(card.openrouter,).toBeUndefined();
        expect([...card.holds,].toSorted(),).toEqual([
          'judge-unmeasured',
          'reader-unmeasured',
          'writer-unmeasured',
        ],);
      },
    },),

    it({
      name: 'SITS ON NO CHAT BENCH: not the run roster, the wide or late judges, the translators, '
        + 'the writers or the readers',
      fn: async () => {
        for (const bench of [
          RUN_ROSTER,
          RUN_WIDE_SEATS,
          RUN_LATE_JUDGES,
          RUN_TRANSLATORS,
          RUN_WRITERS,
          RUN_READER_MODELS,
        ]) {
          expect(bench.includes(SEAT_OPENROUTER_DECISIONS,),).toBe(false,);
        }
      },
    },),

    it({
      name: 'JOINS THE SELECT JUDGES ONLY ONCE MEASURED: held judge-unmeasured it is on no select list, '
        + 'and the select judges are the wide seats plus the measured decision seats',
      fn: async () => {
        expect(RUN_DECISION_JUDGES.includes(SEAT_OPENROUTER_DECISIONS,),).toBe(false,);
        expect([...RUN_SELECT_JUDGES,],).toEqual([
          ...RUN_WIDE_SEATS,
          ...RUN_DECISION_JUDGES,
        ],);
        /**
         Seats on a day OpenRouter is wet and every other provider dry.
         */
        const seats = judgeSeatsFor({
          dry: {
            synthetic: true,
            hyper: true,
            bedrock: true,
            openrouter: false,
          },
        },);
        expect(seats.selectJudges.includes(SEAT_OPENROUTER_DECISIONS,),).toBe(false,);
        expect(seats.repairModels.judgeModelIds,).toEqual(seats.selectJudges,);
        expect(seats.translateModels.judgeModelIds,).toEqual(seats.selectJudges,);
      },
    },),
  ],
},);
