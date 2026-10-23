/**
 Records a finding of round 3 of the second review of the Claude route, red on purpose, with production seating left
 as it is.

 THE FINDING. A seat reading that finds a bench short of its quorum waits out the SHORTEST running hold of ANY provider,
 once (`readDrynessPastShortBench`, `run-seats-read.ts`), and it never asks whether the provider held would serve a seat
 of the short bench when it returns. With the Claude key reading dry, Haiku 5.5 is unserved and the wide bench sits at
 3 of 8 against a quorum of 4 (the padded view of `pass-reseat.unit.test.ts`); a hold on DeepSeek or Xiaomi, whose seats
 are no wide seats of that view, is then waited out in full (a refusal's cooldown is 300,000 ms, a stated return can be
 hours) and the bench is seated short all the same. A hold on Synthetic, OpenRouter, Hyper or the Claude key itself cures
 the shortfall and is worth the wait. The Claude key is not a hold: a dry key is a meter reading, so it holds `0`.

 Each case reads the padded view, and the wait is counted by the dryness reads (one read without a wait, two with).

 @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { BudgetView, } from '@monochromatic-dev/translation-repair-provider';
import { metersAllWet, } from '@monochromatic-dev/translation-repair-provider/ts/meter-states.test-fixture.ts';
import { readJudgeSeats, } from '../../dist/final/node/index.mjs';

/**
 NeuralWatt and Bedrock wet and the Claude key dry: the wide bench is 3 of 8 reachable against a quorum of 4.
 */
const CLAUDE_DRY_PADDED: BudgetView = {
  neuralwatt: false,
  synthetic: true,
  bedrock: false,
  deepseek: true,
  xiaomi: true,
  anthropic: true,
  hyper: true,
  openrouter: true,
};

/**
 No provider held out.
 */
const NO_HOLDS = {
  neuralwatt: 0,
  synthetic: 0,
  bedrock: 0,
  deepseek: 0,
  xiaomi: 0,
  anthropic: 0,
  hyper: 0,
  openrouter: 0,
};

/**
 A hold short enough for a case to wait out on the real clock.
 */
const SHORT_HOLD_MS = 40;

/**
 Logger the readings write to.
 */
const l = tagged({ tag: 'run-seats-hold-cure-test', },);

/**
 Reads the padded view under one hold and counts the dryness reads.

 @param held - provider the hold is on

 @returns Dryness reads the reading took: 1 without a wait, 2 with one

 @example
 ```ts
 const reads = await readsUnderHold({ held: 'deepseek', },);
 ```
 */
async function readsUnderHold(
  { held, }: { readonly held: keyof typeof NO_HOLDS; },
): Promise<number> {
  /**
   Reads taken so far.
   */
  const counter = { reads: 0, };
  await readJudgeSeats({
    client: {
      providerDryness: async (): Promise<BudgetView> => {
        counter.reads += 1;
        return CLAUDE_DRY_PADDED;
      },
      providerMeterStates: metersAllWet,
      providerHolds: () => ({ ...NO_HOLDS, [held]: SHORT_HOLD_MS, }),
    },
    phase: 'lanes',
    signal: new AbortController().signal,
    l,
    pollMs: 5,
  },);
  return counter.reads;
}

await describe({
  name: 'a seat reading under a hold the short bench cannot be cured by',
  concurrency: 1,
  children: [
    it({
      name: 'WAITS OUT A HOLD ON A PROVIDER WHOSE RETURN CURES THE SHORTFALL (the control, green): with Synthetic back the '
        + 'wide bench is 4 of 8 against a quorum of 4, so the wait buys the quorum',
      fn: async () => {
        expect(await readsUnderHold({ held: 'synthetic', },),).toBe(2,);
        expect(await readsUnderHold({ held: 'openrouter', },),).toBe(2,);
      },
    },),
    it({
      name: 'DOES NOT WAIT OUT A HOLD ON A PROVIDER WHOSE RETURN LEAVES THE BENCH SHORT (the finding, red): with DeepSeek or '
        + 'Xiaomi back the wide bench is still 3 of 8, so the wait buys nothing and the bench is seated short after it',
      fn: async () => {
        expect(await readsUnderHold({ held: 'deepseek', },),).toBe(1,);
        expect(await readsUnderHold({ held: 'xiaomi', },),).toBe(1,);
      },
    },),
  ],
},);
