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
  type BudgetView,
  HYPER_SLOW_JUDGES,
  HYPER_SLOW_SELECT_JUDGES,
  judgeSeatsFor,
  OPENROUTER_CHECKER_SUBSTITUTE,
  OPENROUTER_WITHHELD,
  readJudgeSeats,
  RUN_LATE_JUDGES,
  RUN_MODELS,
  RUN_READER_MODELS,
  RUN_ROSTER,
  RUN_TRANSLATORS,
  RUN_WIDE_SEATS,
  BEDROCK_ONLY_ROSTER_IDS,
  ROSTER_MODEL_IDS,
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

/**
 * No provider held out.
 */
const NO_HOLDS = {
  synthetic: 0,
  bedrock: 0,
  hyper: 0,
  openrouter: 0,
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
 * Builds a client whose dryness view and holds answer as scripted.
 *
 * @param providerDryness - scripted view
 *
 * @param providerHolds - scripted holds, none when absent
 *
 * @returns Client with only the seat reader's surface
 *
 * @example
 * ```ts
 * const client = viewClient({ providerDryness: async () => ALL_WET, },);
 * ```
 */
function viewClient(
  {
    providerDryness,
    providerHolds = () => NO_HOLDS,
  }: {
    readonly providerDryness: () => Promise<BudgetView>;
    readonly providerHolds?: () => typeof NO_HOLDS;
  },
) {
  return {
    providerDryness,
    providerHolds,
  };
}

/**
 * Dryness views handed out in order, the last one repeated, counting reads.
 *
 * @param views - views in the order they are read
 *
 * @returns Reader and the count of reads so far
 *
 * @example
 * ```ts
 * const script = scriptedViews({ views: [BEDROCK_ALONE, ALL_WET,], },);
 * ```
 */
function scriptedViews(
  { views, }: { readonly views: readonly BudgetView[]; },
) {
  const counter = { reads: 0, };
  return {
    counter,
    read: async (): Promise<BudgetView> => {
      const view = views[Math.min(counter.reads, views.length - 1,)];
      counter.reads += 1;
      if (view === undefined)
        throw new Error('scripted views must name at least one view',);
      return view;
    },
  };
}

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
      name: 'LEAVES THE UNMEASURED BEDROCK-ONLY GEMMA SIZES OUT OF EVERY ROLE while the roster still names them',
      fn: async function leavesUnmeasuredOut(): Promise<void> {
        const wet = judgeSeatsFor({ dry: ALL_WET, },);
        for (const unmeasured of BEDROCK_ONLY_ROSTER_IDS) {
          expect(ROSTER_MODEL_IDS.includes(unmeasured,),).toBe(true,);
          expect(RUN_ROSTER.includes(unmeasured,),).toBe(false,);
          expect(wet.roster.includes(unmeasured,),).toBe(false,);
          expect(wet.wideSeats.includes(unmeasured,),).toBe(false,);
          expect(wet.translators.includes(unmeasured,),).toBe(false,);
          expect(wet.checkers.includes(unmeasured,),).toBe(false,);
          expect(wet.readers.includes(unmeasured,),).toBe(false,);
        }
        expect(RUN_ROSTER.length,).toBe(ROSTER_MODEL_IDS.length - BEDROCK_ONLY_ROSTER_IDS.length,);
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

await describe({
  name: readJudgeSeats.name,
  children: [
    it({
      name: 'READS the dryness view off the run client, and SEATS the full bench when the view cannot be '
        + 'read, since an unreadable view is not evidence of dryness',
      fn: async () => {
        /**
         * Logger the readings write to.
         */
        const l = tagged({ tag: 'run-seats-test', },);
        const dry = await readJudgeSeats({
          client: viewClient({ providerDryness: async () => SYNTHETIC_DRY, },),
          phase: 'lanes',
          signal: new AbortController().signal,
          l,
        },);
        expect(dry.dry,).toEqual(SYNTHETIC_DRY,);
        expect(dry.wideSeats.includes(QWEN,),).toBe(false,);

        const wet = await readJudgeSeats({
          client: viewClient({ providerDryness: async () => ALL_WET, },),
          phase: 'lane contest',
          signal: new AbortController().signal,
          l,
        },);
        expect(wet.dry,).toEqual(ALL_WET,);
        expect(wet.wideSeats.includes(QWEN,),).toBe(true,);

        const unread = await readJudgeSeats({
          client: viewClient({
            providerDryness: async () => {
              throw new Error('meters offline',);
            },
          },),
          phase: 'consolidation',
          signal: new AbortController().signal,
          l,
        },);
        expect(unread.dry,).toEqual(ALL_WET,);
        expect(unread.wideSeats.includes(QWEN,),).toBe(true,);
      },
    },),
    it({
      name: 'WAITS OUT THE SHORTEST HOLD ONCE and reads again when a bench this phase leans on cannot '
        + 'reach quorum among the seats a wet provider serves and a provider has named its return, '
        + 'the thirteenth class: Bedrock alone wet at the translate lane, Hyper held for its daily limit',
      fn: async () => {
        const l = tagged({ tag: 'run-seats-test', },);
        const script = scriptedViews({
          views: [
            BEDROCK_ALONE,
            ALL_WET,
          ],
        },);
        const seats = await readJudgeSeats({
          client: viewClient({
            providerDryness: script.read,
            providerHolds: () => ({
              ...NO_HOLDS,
              hyper: 40,
            }),
          },),
          phase: 'translate lane',
          signal: new AbortController().signal,
          l,
          pollMs: 5,
        },);
        expect(script.counter.reads,).toBe(2,);
        expect(seats.dry,).toEqual(ALL_WET,);
        expect(seats.translators,).toEqual(RUN_TRANSLATORS,);
      },
    },),
    it({
      name: 'DOES NOT WAIT when no provider has named its return, seating what it read, nor when every '
        + 'bench can reach quorum however long a provider is held',
      fn: async () => {
        const l = tagged({ tag: 'run-seats-test', },);
        const noHold = scriptedViews({
          views: [
            BEDROCK_ALONE,
            ALL_WET,
          ],
        },);
        const short = await readJudgeSeats({
          client: viewClient({ providerDryness: noHold.read, },),
          phase: 'consolidation',
          signal: new AbortController().signal,
          l,
          pollMs: 5,
        },);
        expect(noHold.counter.reads,).toBe(1,);
        expect(short.dry,).toEqual(BEDROCK_ALONE,);

        const wet = scriptedViews({ views: [ALL_WET,], },);
        const full = await readJudgeSeats({
          client: viewClient({
            providerDryness: wet.read,
            providerHolds: () => ({
              ...NO_HOLDS,
              openrouter: 60_000,
            }),
          },),
          phase: 'consolidation',
          signal: new AbortController().signal,
          l,
          pollMs: 5,
        },);
        expect(wet.counter.reads,).toBe(1,);
        expect(full.dry,).toEqual(ALL_WET,);
      },
    },),
  ],
},);
