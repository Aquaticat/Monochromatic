/**
 Guards class one hundred three (zheermao7, 2026-09-23): the repair lane's
 checker bench was seated once at the lanes boundary, and the lanes phase's
 bench list never named the checkers, so when Synthetic's five-hour window
 ran out two minutes into the lane the two Synthetic-only checker seats were
 unreachable for the rest of it: ten of twelve checker rounds and their
 introduced-defect probes ran on one voice, short of quorum, while the
 substitute a dry reading seats (zheermao6, Synthetic dry from the start:
 two of three on every round) sat idle. The repair lane's per-chunk hook now
 re-reads the seats while a hold runs and hands the driver the roster to
 seat the next chunk with. Cat-themed invention throughout; no corpus
 content appears here.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BudgetView,
  consolidationHooksFor,
  consolidationPolishConfiguration,
  contestHooksFor,
  judgeSeatsFor,
  lanesHooksFor,
  prepareDocumentPair,
  SEAT_BEDROCK_ONLY_VISION_UNSEATED,
  SEAT_OPENROUTER_ONLY,
  SEAT_OPENROUTER_ONLY_CHECKER,
  SEAT_SYNTHETIC_VISION_WITHHELD,
} from '../../dist/final/node/index.mjs';

/**
 The zheermao7 view at 23:15:27 UTC: Synthetic's window spent, Hyper dry,
 Bedrock and OpenRouter wet.
 */
const BEDROCK_AND_OPENROUTER: BudgetView = {
  synthetic: true,
  bedrock: false,
  hyper: true,
  openrouter: false,
};

/**
 No provider held out.
 */
const NO_HOLDS = {
  synthetic: 0,
  bedrock: 0,
  hyper: 0,
  openrouter: 0,
};

/**
 The hold the router registers on a refusal from a meter that reads dry.
 */
const DRY_HOLD_MS = 300_000;

/**
 Synthetic and Bedrock wet, Hyper and OpenRouter dry: the one view under which
 the lanes phase finds benches short (the editors and the refiners) and the
 translate lane finds none (measured 2026-09-28 over all sixteen views).
 */
const HYPER_AND_OPENROUTER_DRY: BudgetView = {
  synthetic: false,
  bedrock: false,
  hyper: true,
  openrouter: true,
};

/**
 A hold short enough for a case to wait it out.
 */
const SHORT_HOLD_MS = 40;

/**
 Logger the hooks write to.
 */
const l = tagged({ tag: 'pass-reseat-test', },);

/**
 Builds a client whose holds can change between chunks and which counts
 its dryness reads.

 @param view - dryness every read answers

 @returns Client beside its read counter and its hold setter

 @example
 ```ts
 const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
 rig.holds.synthetic = DRY_HOLD_MS;
 ```
 */
function viewClient(
  { view, }: { readonly view: BudgetView; },
) {
  /**
   Reads taken so far.
   */
  const counter = { reads: 0, };
  /**
   Holds as the router would report them now.
   */
  const holds = { ...NO_HOLDS, };
  return {
    counter,
    holds,
    client: {
      providerDryness: async (): Promise<BudgetView> => {
        counter.reads += 1;
        return view;
      },
      providerHolds: () => ({ ...holds, }),
    },
  };
}

await describe({
  name: `${lanesHooksFor.name} (class one hundred three)`,
  children: [
    it({
      name: 'RE-SEATS THE REPAIR LANE before a chunk while a hold runs, so the checker seats a dry-out took '
        + 'are filled by the next measured checkers a wet provider serves (class one hundred three, '
        + 'zheermao7, 2026-09-23: ten of twelve checker rounds on one voice after Synthetic ran dry two '
        + 'minutes into the lane)',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        rig.holds.synthetic = DRY_HOLD_MS;
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        /**
         Roster the hook hands the driver for the next chunk.
         */
        const seating = await hooks.beforeSlice({ lane: 'repair', },);
        expect(seating.repairModels,).toBeDefined();
        expect(seating.repairModels?.checkerModelIds,).toEqual([
          SEAT_OPENROUTER_ONLY_CHECKER,
          SEAT_BEDROCK_ONLY_VISION_UNSEATED,
          SEAT_OPENROUTER_ONLY,
        ],);
        expect(seating.repairModels?.checkerModelIds,).not.toContain(SEAT_SYNTHETIC_VISION_WITHHELD,);
        expect(rig.counter.reads,).toBe(1,);
      },
    },),
    it({
      name: 'COSTS NOTHING while nothing is held: no dryness read, nothing to seat, so a pass under wet '
        + 'providers asks its meters exactly as often as before',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        expect(await hooks.beforeSlice({ lane: 'repair', },),).toEqual({},);
        expect(rig.counter.reads,).toBe(0,);
      },
    },),
    it({
      name: 'KEEPS THE LATEST SEATING once the hold has ended, so the chunks after it are not seated on '
        + 'the roster read before the dry-out',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        rig.holds.synthetic = DRY_HOLD_MS;
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        /**
         Roster read under the hold.
         */
        const underHold = await hooks.beforeSlice({ lane: 'repair', },);
        rig.holds.synthetic = 0;
        /**
         Roster handed over once the hold has ended.
         */
        const afterHold = await hooks.beforeSlice({ lane: 'repair', },);
        expect(afterHold.repairModels,).toBeDefined();
        expect(afterHold,).toEqual(underHold,);
        expect(rig.counter.reads,).toBe(1,);
      },
    },),
    it({
      name: 'COSTS NOTHING on the translate lane either while nothing is held: no dryness read, nothing to seat',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        expect(await hooks.beforeSlice({ lane: 'translate', },),).toEqual({},);
        expect(rig.counter.reads,).toBe(0,);
      },
    },),
    it({
      name: 'RE-SEATS THE TRANSLATE LANE before a slice while a hold runs, as it does the repair lane, and keeps '
        + 'that roster once the hold has ended (ledger H5: the fourth stage of a family classes one hundred '
        + 'three, one hundred nine and one hundred thirteen fixed one at a time)',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        rig.holds.synthetic = DRY_HOLD_MS;
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        /**
         Roster the hook hands the translate lane under the hold.
         */
        const underHold = await hooks.beforeSlice({ lane: 'translate', },);
        rig.holds.synthetic = 0;
        /**
         Roster handed over once the hold has ended.
         */
        const afterHold = await hooks.beforeSlice({ lane: 'translate', },);
        /**
         What a reading of this view seats on the translate lane.
         */
        const { translateModels, } = judgeSeatsFor({ dry: BEDROCK_AND_OPENROUTER, },);
        expect({
          underHold,
          afterHold,
          reads: rig.counter.reads,
        },).toEqual({
          underHold: { translateModels, },
          afterHold: { translateModels, },
          reads: 1,
        },);
      },
    },),
    it({
      name: 'KEEPS EACH LANE\'S SEATING APART: a repair chunk re-seated under a hold hands the translate lane '
        + 'nothing once the hold has ended, since the translate lane has not read its own',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        rig.holds.synthetic = DRY_HOLD_MS;
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        /**
         Seating the repair lane took under the hold.
         */
        const repair = await hooks.beforeSlice({ lane: 'repair', },);
        rig.holds.synthetic = 0;
        /**
         Seating the translate lane is handed once the hold has ended.
         */
        const translate = await hooks.beforeSlice({ lane: 'translate', },);
        expect({
          repairSeated: repair.repairModels !== undefined,
          translate,
          reads: rig.counter.reads,
        },).toEqual({
          repairSeated: true,
          translate: {},
          reads: 1,
        },);
      },
    },),
    it({
      name: 'READS EACH LANE UNDER ITS OWN PHASE: with Hyper and OpenRouter dry and Hyper held, the editors and '
        + 'refiners the lanes phase leans on are short while the translate lane\'s translators and select '
        + 'judges are not, so the translate lane seats on one read and the repair lane waits the hold out '
        + 'and stops the entry',
      fn: async () => {
        const rig = viewClient({ view: HYPER_AND_OPENROUTER_DRY, },);
        rig.holds.hyper = SHORT_HOLD_MS;
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        /**
         Seating the translate lane takes under the hold.
         */
        const translate = await hooks.beforeSlice({ lane: 'translate', },);
        /**
         Dryness reads the translate lane's seating took.
         */
        const translateReads = rig.counter.reads;
        await expect(hooks.beforeSlice({ lane: 'repair', },),)
          .rejects
          .toThrow('writing bench unreachable at lanes: editors',);
        expect({
          translateSeated: translate.translateModels !== undefined,
          translateReads,
          repairReads: rig.counter.reads - translateReads,
        },).toEqual({
          translateSeated: true,
          translateReads: 1,
          repairReads: 2,
        },);
      },
    },),
  ],
},);

/**
 A two-paragraph page the consolidation's naturalness roles read.
 */
const PREPARED = prepareDocumentPair({
  sourceText: '猫在窗边睡着了。\n\n它梦见了鱼。',
  targetText: 'The cat fell asleep by the window.\n\nIt dreamed of fish.',
},);

await describe({
  name: `${consolidationHooksFor.name} (ledger H5)`,
  children: [
    it({
      name: 'RE-SEATS THE CONSOLIDATION before a slice while a hold runs, as it does both lanes, handing the '
        + 'slice the reading\'s writers, slate judges and naturalness roles, and keeps that roster once the '
        + 'hold has ended',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        rig.holds.synthetic = DRY_HOLD_MS;
        const hooks = consolidationHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          prepared: PREPARED,
          l,
        },);
        /**
         Seating the hook hands the slice under the hold.
         */
        const underHold = await hooks.beforeSlice();
        rig.holds.synthetic = 0;
        /**
         Seating handed over once the hold has ended.
         */
        const afterHold = await hooks.beforeSlice();
        /**
         What a reading of this view seats.
         */
        const seats = judgeSeatsFor({ dry: BEDROCK_AND_OPENROUTER, },);
        /**
         Naturalness roles that reading configures, as `pass-consolidate.ts` builds them.
         */
        const polish = consolidationPolishConfiguration({
          prepared: PREPARED,
          models: seats.repairModels,
          gateModelIds: seats.lateJudges,
        },);
        /**
         Roster the slice should run on.
         */
        const roster = {
          modelIds: seats.writers,
          judgeModelIds: seats.slateJudges,
          ...((polish.kind === 'configured') ? { polishConfig: polish.config, } : {}),
        };
        expect({
          underHold,
          afterHold,
          reads: rig.counter.reads,
        },).toEqual({
          underHold: { roster, },
          afterHold: { roster, },
          reads: 1,
        },);
      },
    },),
    it({
      name: 'COSTS NOTHING while nothing is held: no dryness read and no roster, so the slice keeps the one '
        + 'the consolidation started on',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        const hooks = consolidationHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          prepared: PREPARED,
          l,
        },);
        expect(await hooks.beforeSlice(),).toEqual({},);
        expect(rig.counter.reads,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: `${contestHooksFor.name} (ledger X12)`,
  children: [
    it({
      name: 'RE-SEATS THE LANE CONTEST before a slice while a hold runs, as it does the lanes and the '
        + 'consolidation, handing the slice the reading\'s judges, and keeps them once the hold has ended',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        rig.holds.synthetic = DRY_HOLD_MS;
        const hooks = contestHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          l,
        },);
        /**
         Seating the hook hands the slice under the hold.
         */
        const underHold = await hooks.beforeSlice();
        rig.holds.synthetic = 0;
        /**
         Seating handed over once the hold has ended.
         */
        const afterHold = await hooks.beforeSlice();
        /**
         Judges a reading of this view seats.
         */
        const { lateJudges, } = judgeSeatsFor({ dry: BEDROCK_AND_OPENROUTER, },);
        expect({
          underHold,
          afterHold,
          reads: rig.counter.reads,
        },).toEqual({
          underHold: { modelIds: lateJudges, },
          afterHold: { modelIds: lateJudges, },
          reads: 1,
        },);
      },
    },),
    it({
      name: 'COSTS NOTHING while nothing is held: no dryness read and no judges, so the slice keeps those '
        + 'the contest started on',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        const hooks = contestHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          l,
        },);
        expect(await hooks.beforeSlice(),).toEqual({},);
        expect(rig.counter.reads,).toBe(0,);
      },
    },),
  ],
},);
