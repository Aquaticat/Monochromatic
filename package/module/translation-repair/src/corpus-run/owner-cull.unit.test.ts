/**
 Guards the owner's cull of 2026-09-24: "That particular model got cause and
 effect wrong. Cull it." and then "cull it from every role", said of the
 critic that filed, alone, an accepted omission claim reading 服用激素，成为跨
 性别的原因 as hormones being the reason for transitioning (CuspariaKLSY10
 slice 1), the same seat that abstained on a slate over "quoted lines in
 present tense" where no line was quoted (zheermao8 slice 9). The card stays
 for the catalogs and the unit fixture; the seats go. Cat-themed invention in
 every fixture; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BudgetView,
  judgeSeatsFor,
  OWNER_CULLED,
  ROSTER_MODEL_IDS,
  RUN_LATE_JUDGES,
  RUN_MODELS,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_SELECT_JUDGES,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  RUN_WRITERS,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
} from '../../dist/final/node/index.mjs';

/**
 Every provider wet, the reading that seats the widest benches.
 */
const ALL_WET: BudgetView = {
  synthetic: false,
  hyper: false,
  bedrock: false,
  openrouter: false,
};

/**
 Every provider dry, the reading that seats the substitute checker.
 */
const ALL_DRY: BudgetView = {
  synthetic: true,
  hyper: true,
  bedrock: true,
  openrouter: true,
};

await describe({
  name: 'the owner\'s cull of 2026-09-24',
  children: [
    it({
      name: 'HOLDS THE CULLED SEAT OUT OF EVERY STATIC BENCH while its card stays on the catalogs',
      fn: async () => {
        expect(OWNER_CULLED.has(SEAT_SYNTHETIC_TEXT_EVERYWHERE,),).toBe(true,);
        expect(ROSTER_MODEL_IDS.includes(SEAT_SYNTHETIC_TEXT_EVERYWHERE,),).toBe(true,);
        for (
          const bench of [
            RUN_ROSTER,
            RUN_WIDE_SEATS,
            RUN_LATE_JUDGES,
            RUN_SELECT_JUDGES,
            RUN_TRANSLATORS,
            RUN_WRITERS,
            RUN_READER_MODELS,
            RUN_MODELS.checkerModelIds,
            RUN_MODELS.editorModelIds,
            RUN_MODELS.refinerModelIds ?? [],
          ]
        ) {
          expect(bench.includes(SEAT_SYNTHETIC_TEXT_EVERYWHERE,),).toBe(false,);
        }
      },
    },),
    it({
      name: 'SEATS NOBODY CULLED ON ANY READING, wet or dry, and keeps three checkers on the static bench',
      fn: async () => {
        for (const dry of [ALL_WET, ALL_DRY,]) {
          /**
           Seats derived from this reading.
           */
          const seats = judgeSeatsFor({ dry, },);
          for (
            const bench of [
              seats.roster,
              seats.wideSeats,
              seats.selectJudges,
              seats.lateJudges,
              seats.slateJudges,
              seats.checkers,
              seats.translators,
              seats.readers,
              seats.writers,
              seats.repairModels.criticModelIds,
              seats.repairModels.panelModelIds,
              seats.repairModels.checkerModelIds,
            ]
          ) {
            expect(bench.includes(SEAT_SYNTHETIC_TEXT_EVERYWHERE,),).toBe(false,);
          }
        }
        expect(RUN_MODELS.checkerModelIds.length,).toBe(3,);
      },
    },),
  ],
},);
