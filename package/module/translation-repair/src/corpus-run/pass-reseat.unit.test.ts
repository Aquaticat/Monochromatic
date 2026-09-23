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
  lanesHooksFor,
  OPENROUTER_CHECKER_SUBSTITUTE,
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
      name: 'RE-SEATS THE REPAIR LANE before a chunk while a hold runs, so a checker seat a dry-out took '
        + 'is filled by the substitute (class one hundred three, zheermao7, 2026-09-23: ten of twelve '
        + 'checker rounds on one voice after Synthetic ran dry two minutes into the lane)',
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
        const models = await hooks.beforeSlice({ lane: 'repair', },);
        expect(models,).toBeDefined();
        expect(models?.checkerModelIds,).toContain(OPENROUTER_CHECKER_SUBSTITUTE,);
        expect(models?.checkerModelIds,).not.toContain(SEAT_SYNTHETIC_VISION_WITHHELD,);
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
        expect(await hooks.beforeSlice({ lane: 'repair', },),).toBeUndefined();
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
        expect(afterHold,).toEqual(underHold,);
        expect(rig.counter.reads,).toBe(1,);
      },
    },),
    it({
      name: 'WAITS ONLY, on the translate lane, as the thirteenth class built it: nothing to seat',
      fn: async () => {
        const rig = viewClient({ view: BEDROCK_AND_OPENROUTER, },);
        const hooks = lanesHooksFor({
          client: rig.client,
          signal: new AbortController().signal,
          entryId: 'mittens',
        },);
        expect(await hooks.beforeSlice({ lane: 'translate', },),).toBeUndefined();
        expect(rig.counter.reads,).toBe(0,);
      },
    },),
  ],
},);
