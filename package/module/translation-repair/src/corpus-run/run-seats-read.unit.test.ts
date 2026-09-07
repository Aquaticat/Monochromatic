/**
 * Tests for the seat readings a phase and a chunk take past a named hold.
 *
 * THE THIRTEENTH CLASS IN BOTH ITS FACES. Before a phase (the third hakureico
 * pass of 2026-09-07, translate lane and consolidation on nobody under a
 * 538 s hold) and inside one (the fourth pass, a 923 s hold two minutes into
 * consolidation, slice 5 stopping the entry). The phase reading waits when a
 * bench it leans on cannot reach quorum; the chunk reading does the same and
 * costs nothing while nothing is held.
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
  awaitBenchQuorum,
  type BudgetView,
  readJudgeSeats,
  RUN_TRANSLATORS,
} from '../../dist/final/node/index.mjs';

//region Seat reading tests

/**
 * The Hyper-slow judge.
 */
const QWEN = 'hf:Qwen/Qwen3.8-27B';

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
 * Synthetic alone dry.
 */
const SYNTHETIC_DRY: BudgetView = {
  synthetic: true,
  bedrock: false,
  hyper: false,
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
 * Logger the readings write to.
 */
const l = tagged({ tag: 'run-seats-read-test', },);

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
  name: readJudgeSeats.name,
  children: [
    it({
      name: 'READS the dryness view off the run client, and SEATS the full bench when the view cannot be '
        + 'read, since an unreadable view is not evidence of dryness',
      fn: async () => {
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

await describe({
  name: awaitBenchQuorum.name,
  children: [
    it({
      name: 'COSTS NOTHING while nothing is held: no dryness read, no wait, so a pass under wet providers '
        + 'asks its meters exactly as often as before',
      fn: async () => {
        const script = scriptedViews({ views: [BEDROCK_ALONE,], },);
        const waited = await awaitBenchQuorum({
          client: viewClient({ providerDryness: script.read, },),
          phase: 'consolidation',
          signal: new AbortController().signal,
          l,
          pollMs: 5,
        },);
        expect(waited,).toBe(0,);
        expect(script.counter.reads,).toBe(0,);
      },
    },),
    it({
      name: 'WAITS OUT THE SHORTEST HOLD before the chunk when a bench the phase leans on cannot reach '
        + 'quorum, the fourth hakureico pass: a 923 s hold two minutes into consolidation',
      fn: async () => {
        const script = scriptedViews({
          views: [
            BEDROCK_ALONE,
            ALL_WET,
          ],
        },);
        const waited = await awaitBenchQuorum({
          client: viewClient({
            providerDryness: script.read,
            providerHolds: () => ({
              ...NO_HOLDS,
              hyper: 40,
            }),
          },),
          phase: 'consolidation',
          signal: new AbortController().signal,
          l,
          pollMs: 5,
        },);
        expect(waited,).toBe(40,);
        expect(script.counter.reads,).toBe(2,);
      },
    },),
    it({
      name: 'LETS THE CHUNK START when a provider is held but every bench can still reach quorum',
      fn: async () => {
        const script = scriptedViews({ views: [ALL_WET,], },);
        const waited = await awaitBenchQuorum({
          client: viewClient({
            providerDryness: script.read,
            providerHolds: () => ({
              ...NO_HOLDS,
              openrouter: 60_000,
            }),
          },),
          phase: 'lanes',
          signal: new AbortController().signal,
          l,
          pollMs: 5,
        },);
        expect(waited,).toBe(0,);
        expect(script.counter.reads,).toBe(1,);
      },
    },),
  ],
},);

//endregion Seat reading tests
