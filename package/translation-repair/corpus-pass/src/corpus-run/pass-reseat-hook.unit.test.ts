/**
 Tests the per-slice re-seating hook against the bound its client carries.

 The hook reads the seats again while a hold runs, and a NeuralWatt return counts as a hold only when it lies inside
 what the pass has left: a return past it is not a hold, so the hook costs nothing and hands the slice the seating it had.
 The client here answers its holds the way the budgets do, by honouring the bound it is asked with.

 Fixtures are cat-themed invention; every view is scripted and no HTTP is made.

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { BudgetView, } from '@monochromatic-dev/translation-repair-provider';
import { reseatHookFor, } from '../../dist/final/node/index.mjs';
import { metersAllWet, } from '@monochromatic-dev/translation-repair-provider/ts/meter-states.test-fixture.ts';

/**
 Every provider wet.
 */
const ALL_WET: BudgetView = {
  neuralwatt: false,
  synthetic: false,
  bedrock: false,
  deepseek: false,
  xiaomi: false,
  hyper: false,
  openrouter: false,
};

/**
 The seating a slice runs on before any hold has run.
 */
const UNSEATED = { seated: 'roster', };

/**
 The seating a reading hands the slices.
 */
const RESEATED = { seated: 'read under a hold', };

/**
 The hook over a client whose NeuralWatt return is `returnInMs` away, answering holds by the bound it is asked with.

 @param returnInMs - milliseconds until NeuralWatt's day starts again

 @param passLeftMs - what the pass has left

 @returns The hook and the dryness reads counted

 @example
 ```ts
 const { hook, reads, } = hookBefore({ returnInMs: 700, passLeftMs: 600, },);
 ```
 */
function hookBefore(
  {
    returnInMs,
    passLeftMs,
  }: {
    readonly returnInMs: number;
    readonly passLeftMs: number;
  },
) {
  const reads = { count: 0, };
  const hook = reseatHookFor({
    client: {
      providerDryness: async () => {
        reads.count += 1;
        return ALL_WET;
      },
      providerMeterStates: metersAllWet,
      providerHolds: ({ returnBoundMs = Number.POSITIVE_INFINITY, }: { readonly returnBoundMs?: number; } = {},) => ({
        neuralwatt: (returnInMs <= returnBoundMs) ? returnInMs : 0,
        synthetic: 0,
        bedrock: 0,
        deepseek: 0,
        xiaomi: 0,
        hyper: 0,
        openrouter: 0,
      }),
      passLeftMs: () => passLeftMs,
    },
    signal: new AbortController().signal,
    phase: 'lane contest',
    unseated: UNSEATED,
    seatingOf: () => ({ seating: RESEATED, line: 'slice re-seated under a hold', }),
    l: tagged({ tag: 'pass-reseat-hook-test', },),
  },);
  return { hook, reads, };
}

await describe({
  name: reseatHookFor.name,
  concurrency: 1,
  children: [
    it({
      name: 'READS NOTHING FOR A RETURN PAST WHAT THE PASS HAS LEFT: 700 away with 600 left is no hold, so the slice keeps '
        + 'the seating it had and no dryness is read',
      fn: async () => {
        const { hook, reads, } = hookBefore({ returnInMs: 700, passLeftMs: 600, },);
        expect(await hook(),).toEqual(UNSEATED,);
        expect(reads.count,).toBe(0,);
      },
    },),

    it({
      name: 'READS THE SEATS FOR A RETURN INSIDE WHAT THE PASS HAS LEFT: 500 away with 600 left is a hold, so the slice '
        + 'takes the seating the reading gives',
      fn: async () => {
        const { hook, reads, } = hookBefore({ returnInMs: 500, passLeftMs: 600, },);
        expect(await hook(),).toEqual(RESEATED,);
        expect(reads.count,).toBe(1,);
      },
    },),

    it({
      name: 'READS NOTHING WHEN THE BOUND IS ZERO OR BELOW, the pass or the entry\'s cap spent, whatever return is named',
      fn: async () => {
        const { hook, reads, } = hookBefore({ returnInMs: 5, passLeftMs: -1, },);
        expect(await hook(),).toEqual(UNSEATED,);
        expect(reads.count,).toBe(0,);
      },
    },),
  ],
},);
