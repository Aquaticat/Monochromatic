/**
 * Tests the provider-aware judge seats.
 *
 * THE CASES: Qwen3.8-27B, cut in 30 of 34 translate-lane select rounds when
 * Hyper served it (XIEPT2, 2026-09-03) and answering 25 of 28 when Synthetic
 * did (Toka_ls, 2026-09-02), withheld while Hyper would serve it; Kimi-K3,
 * withheld from the select seats while Hyper would serve it and from every
 * seat while only OpenRouter would (the owner's cost decision of 2026-09-03),
 * with a substitute checker keeping the roster's floor; the full bench when
 * the view cannot be read; and the static drops holding either way.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  BEDROCK_ONLY_ROSTER_IDS,
  type BudgetView,
  HYPER_SLOW_JUDGES,
  HYPER_SLOW_SELECT_JUDGES,
  judgeSeatsFor,
  OPENROUTER_CHECKER_SUBSTITUTE,
  OPENROUTER_ONLY_ROSTER_IDS,
  OPENROUTER_WITHHELD,
  ROSTER_MODEL_IDS,
  RUN_LATE_JUDGES,
  RUN_MODELS,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  RUN_WRITERS,
  SEATED_BEDROCK_JUDGES,
  SEATED_OPENROUTER_JUDGES,
  WRITER_UNMEASURED,
} from '../../dist/final/node/index.mjs';

/**
 * The Hyper-slow judge.
 */
const QWEN = 'hf:Qwen/Qwen3.8-27B';

/**
 * The judge Hyper serves too slowly in the select role alone, and the one the
 * owner declined to pay OpenRouter's rate on.
 */
const KIMI = 'hf:moonshotai/Kimi-K3';

/**
 * Nobody dry.
 */
const ALL_WET: BudgetView = {
  synthetic: false,
  hyper: false,
  bedrock: false,
  openrouter: false,
};

/**
 * Synthetic dry, Hyper serving the shared seats.
 */
const SYNTHETIC_DRY: BudgetView = {
  synthetic: true,
  hyper: false,
  bedrock: false,
  openrouter: false,
};

/**
 * Only OpenRouter left.
 */
const OPENROUTER_ONLY: BudgetView = {
  synthetic: true,
  hyper: true,
  bedrock: true,
  openrouter: false,
};

await describe({
  name: judgeSeatsFor.name,
  children: [
    it({
      name: 'WITHHOLDS the Hyper-slow judge from both benches when Hyper would serve it and SEATS it when '
        + 'Synthetic does, with the static drops holding either way',
      fn: async () => {
        expect(HYPER_SLOW_JUDGES.has(QWEN,),).toBe(true,);
        expect(RUN_WIDE_SEATS.includes(QWEN,),).toBe(true,);
        expect(RUN_LATE_JUDGES.includes(QWEN,),).toBe(true,);

        const dry = judgeSeatsFor({ dry: SYNTHETIC_DRY, },);
        expect(dry.wideSeats.includes(QWEN,),).toBe(false,);
        expect(dry.lateJudges.includes(QWEN,),).toBe(false,);
        expect(dry.wideSeats.length,).toBe(RUN_WIDE_SEATS.length - 1,);
        expect(dry.lateJudges.length,).toBe(RUN_LATE_JUDGES.length - 1,);
        expect(dry.repairModels.criticModelIds,).toEqual(dry.wideSeats,);
        expect(dry.repairModels.panelModelIds,).toEqual(dry.wideSeats,);
        expect(dry.repairModels.judgeModelIds,).toEqual(dry.selectJudges,);
        expect(dry.translateModels.judgeModelIds,).toEqual(dry.selectJudges,);
        expect(dry.wideSeats.includes('hf:zai-org/GLM-5.3-Flash',),).toBe(false,);
        expect(dry.withheld.includes(QWEN,),).toBe(true,);

        const wet = judgeSeatsFor({ dry: ALL_WET, },);
        expect(wet.wideSeats,).toEqual(RUN_WIDE_SEATS,);
        expect(wet.lateJudges,).toEqual(RUN_LATE_JUDGES,);
        expect(wet.selectJudges,).toEqual(RUN_WIDE_SEATS,);
        expect(wet.slateJudges,).toEqual(RUN_LATE_JUDGES,);
        expect(wet.checkers,).toEqual(RUN_MODELS.checkerModelIds,);
        expect(wet.translators,).toEqual(RUN_TRANSLATORS,);
        expect(wet.readers,).toEqual(RUN_READER_MODELS,);
        expect(wet.roster,).toEqual(RUN_ROSTER,);
        expect(wet.translateModels.translatorModelIds,).toEqual(RUN_TRANSLATORS,);
        expect(wet.withheld,).toEqual([],);
        expect(wet.wideSeats.includes('hf:zai-org/GLM-5.3-Flash',),).toBe(false,);
      },
    },),

    it({
      name: 'SEATS THE MEASURED BEDROCK-ONLY SIZES WHERE THEY WERE MEASURED AND NOWHERE ELSE while the roster '
        + 'names both: google.gemma-4-e2b judges (11 of 12 on the fidelity probe of 2026-09-07), reads no '
        + 'pictures (two readings no seated reader corroborated, 2026-09-08) and writes in both lanes (30 of '
        + '298 disinterested ballots in the producer calibration of 2026-09-08, not separated from the pooled '
        + 'null); google.gemma-4-31b reads pictures (8 of 8 corroborated), judges nothing and writes nothing; '
        + 'inception/mercury-2.5 judges (14 of 14 on the fidelity probe of 2026-09-09) and writes in both lanes '
        + '(18 of 101 disinterested ballots in the producer calibration of the same day, z -0.43, not separated '
        + 'from the pooled null)',
      fn: async function seatsByMeasurement(): Promise<void> {
        const wet = judgeSeatsFor({ dry: ALL_WET, },);
        for (const candidate of BEDROCK_ONLY_ROSTER_IDS) {
          expect(ROSTER_MODEL_IDS.includes(candidate,),).toBe(true,);
          expect(wet.checkers.includes(candidate,),).toBe(false,);
        }
        expect(wet.translators.includes('google.gemma-4-e2b',),).toBe(true,);
        expect(wet.writers.includes('google.gemma-4-e2b',),).toBe(true,);
        expect(wet.translators.includes('google.gemma-4-31b',),).toBe(false,);
        expect(wet.writers.includes('google.gemma-4-31b',),).toBe(false,);
        expect(wet.readers.includes('google.gemma-4-e2b',),).toBe(false,);
        expect(wet.readers.includes('google.gemma-4-31b',),).toBe(true,);
        for (const seated of SEATED_BEDROCK_JUDGES) {
          expect(RUN_ROSTER.includes(seated,),).toBe(true,);
          expect(wet.roster.includes(seated,),).toBe(true,);
          expect(wet.wideSeats.includes(seated,),).toBe(true,);
          expect(wet.selectJudges.includes(seated,),).toBe(true,);
          expect(wet.lateJudges.includes(seated,),).toBe(true,);
          expect(wet.slateJudges.includes(seated,),).toBe(true,);
        }
        expect(RUN_ROSTER.includes('google.gemma-4-31b',),).toBe(false,);
        expect(wet.wideSeats.includes('google.gemma-4-31b',),).toBe(false,);
        // A model one provider alone serves holds no seat until measured in.
        for (const seated of SEATED_OPENROUTER_JUDGES) {
          expect(RUN_ROSTER.includes(seated,),).toBe(true,);
          expect(wet.roster.includes(seated,),).toBe(true,);
          expect(wet.wideSeats.includes(seated,),).toBe(true,);
          expect(wet.selectJudges.includes(seated,),).toBe(true,);
          expect(wet.lateJudges.includes(seated,),).toBe(true,);
          expect(wet.slateJudges.includes(seated,),).toBe(true,);
          expect(wet.checkers.includes(seated,),).toBe(false,);
          expect(wet.readers.includes(seated,),).toBe(false,);
        }
        // The calibration read at 20:02 UTC on 2026-09-09 seated the one
        // OpenRouter-only model as a writer; the build before it fails here.
        expect(wet.translators.includes('inception/mercury-2.5',),).toBe(true,);
        expect(wet.writers.includes('inception/mercury-2.5',),).toBe(true,);
        for (const unmeasured of WRITER_UNMEASURED) {
          expect(wet.writers.includes(unmeasured,),).toBe(false,);
          expect(wet.translators.includes(unmeasured,),).toBe(false,);
        }
        expect(RUN_ROSTER.length,).toBe(
          (ROSTER_MODEL_IDS.length - BEDROCK_ONLY_ROSTER_IDS.length - OPENROUTER_ONLY_ROSTER_IDS.length)
            + SEATED_BEDROCK_JUDGES.size
            + SEATED_OPENROUTER_JUDGES.size,
        );
        expect(wet.writers,).toEqual(RUN_WRITERS,);
        expect(RUN_WRITERS,).toEqual(RUN_ROSTER.filter(function measuredWriter(modelId,): boolean {
          return !WRITER_UNMEASURED.has(modelId,);
        },),);
        expect(RUN_TRANSLATORS.length,).toBe(RUN_ROSTER.length - 2 - WRITER_UNMEASURED.size,);
      },
    },),

    it({
      name: 'SEATS the Hyper-slow judge again when Hyper is dry too and OpenRouter would serve it, since '
        + 'the withholding is about Hyper\'s serving speed and not about the model',
      fn: async () => {
        const seats = judgeSeatsFor({ dry: OPENROUTER_ONLY, },);
        expect(seats.wideSeats.includes(QWEN,),).toBe(true,);
        expect(seats.lateJudges.includes(QWEN,),).toBe(true,);
        expect(seats.selectJudges.includes(QWEN,),).toBe(true,);
      },
    },),

    it({
      name: 'WITHHOLDS the select-slow judge from both lanes\' select seats and the consolidation slate when '
        + 'Hyper would serve it, KEEPS it as critic, panel, contest judge and gate, and SEATS it everywhere '
        + 'when Synthetic does',
      fn: async () => {
        expect(HYPER_SLOW_SELECT_JUDGES.has(KIMI,),).toBe(true,);
        expect(HYPER_SLOW_JUDGES.has(KIMI,),).toBe(false,);

        const dry = judgeSeatsFor({ dry: SYNTHETIC_DRY, },);
        expect(dry.selectJudges.includes(KIMI,),).toBe(false,);
        expect(dry.slateJudges.includes(KIMI,),).toBe(false,);
        expect(dry.wideSeats.includes(KIMI,),).toBe(true,);
        expect(dry.lateJudges.includes(KIMI,),).toBe(true,);
        expect(dry.checkers.includes(KIMI,),).toBe(true,);
        expect(dry.selectJudges.length,).toBe(dry.wideSeats.length - 1,);
        expect(dry.slateJudges.length,).toBe(dry.lateJudges.length - 1,);
        expect(dry.repairModels.criticModelIds.includes(KIMI,),).toBe(true,);
        expect(dry.repairModels.panelModelIds.includes(KIMI,),).toBe(true,);
        expect(dry.repairModels.judgeModelIds.includes(KIMI,),).toBe(false,);
        expect(dry.translateModels.judgeModelIds.includes(KIMI,),).toBe(false,);

        const wet = judgeSeatsFor({ dry: ALL_WET, },);
        expect(wet.selectJudges.includes(KIMI,),).toBe(true,);
        expect(wet.slateJudges.includes(KIMI,),).toBe(true,);
      },
    },),

    it({
      name: 'WITHHOLDS THE OPENROUTER-WITHHELD MODEL FROM EVERY SEAT when only OpenRouter would serve it, '
        + 'the owner\'s decision of 2026-09-03 on cost, THE WRITING AND READING SEATS INCLUDED, since the '
        + 'first OpenRouter-only pass bought six translations from it while every bench had it out, and '
        + 'SEATS THE SUBSTITUTE CHECKER so the roster keeps the floor the contract holds',
      fn: async () => {
        expect(OPENROUTER_WITHHELD.has(KIMI,),).toBe(true,);
        expect(RUN_MODELS.checkerModelIds.includes(KIMI,),).toBe(true,);
        expect(RUN_TRANSLATORS.includes(KIMI,),).toBe(true,);
        expect(RUN_READER_MODELS.includes(KIMI,),).toBe(true,);
        expect(RUN_MODELS.checkerModelIds.includes(OPENROUTER_CHECKER_SUBSTITUTE,),).toBe(false,);
        expect(RUN_MODELS.editorModelIds.includes(OPENROUTER_CHECKER_SUBSTITUTE,),).toBe(false,);
        expect((RUN_MODELS.refinerModelIds ?? []).includes(OPENROUTER_CHECKER_SUBSTITUTE,),).toBe(false,);

        const seats = judgeSeatsFor({ dry: OPENROUTER_ONLY, },);
        expect(seats.wideSeats.includes(KIMI,),).toBe(false,);
        expect(seats.selectJudges.includes(KIMI,),).toBe(false,);
        expect(seats.lateJudges.includes(KIMI,),).toBe(false,);
        expect(seats.slateJudges.includes(KIMI,),).toBe(false,);
        expect(seats.checkers.includes(KIMI,),).toBe(false,);
        expect(seats.checkers.includes(OPENROUTER_CHECKER_SUBSTITUTE,),).toBe(true,);
        expect(seats.checkers.length,).toBe(RUN_MODELS.checkerModelIds.length,);
        expect(seats.repairModels.checkerModelIds,).toEqual(seats.checkers,);
        expect(seats.translators.includes(KIMI,),).toBe(false,);
        expect(seats.translators.length,).toBe(RUN_TRANSLATORS.length - 1,);
        expect(seats.translateModels.translatorModelIds,).toEqual(seats.translators,);
        expect(seats.readers.includes(KIMI,),).toBe(false,);
        expect(seats.readers.length,).toBe(RUN_READER_MODELS.length - 1,);
        expect(RUN_ROSTER.includes(KIMI,),).toBe(true,);
        expect(seats.roster.includes(KIMI,),).toBe(false,);
        expect(seats.roster.length,).toBe(RUN_ROSTER.length - 1,);
        expect(seats.withheld,).toEqual([KIMI,],);
      },
    },),
  ],
},);
