/**
 Tests that the seat reader waits only for a hold whose provider, back, would cure a short bench, and says which
 providers could when it seats a bench short.

 THE SHAPE, from the second review of the Claude route (round 3): with one provider's key dry the wide bench stands one
 seat short of its quorum, and a hold on a provider that serves no seat the bench lacks is waited out in full (a
 refusal's cooldown is 300,000 ms, a stated return can be hours) and the bench is seated short all the same. Here the
 fleet is the live roster of this tree, NeuralWatt and Bedrock wet and the rest dry: the wide bench is 3 of 7 against a
 quorum of 4. Synthetic, Hyper or OpenRouter back reach the quorum; DeepSeek or Xiaomi back leave it at 3 of 7
 (DeepSeek's one wide seat is one Bedrock or NeuralWatt already reach). THE CLAUDE KEY IS NOT IN THIS TREE (its route
 is another branch), so the case where that key is the dry one is added when the branches meet; the rule is the same.

 TWO HOLDS THAT EACH CURE ALONE (round 5): a hold counts when the held set cures the bench between them and that
 provider's return adds a reachable seat to it. A rule asking that the bench stay short without the provider counted
 neither of two providers that each reach the quorum alone, and the reader seated the bench short without waiting.

 Each case reads the phase that leans on the wide bench alone, and the wait is counted by the dryness reads (one read
 without a wait, two with).

 Fixtures are cat-themed invention; every view and hold is scripted and no HTTP is made.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { BudgetView, } from '@monochromatic-dev/translation-repair-provider';
import {
  type ProviderName,
  providerRecord,
} from '@monochromatic-dev/translation-repair-shared-contract/ts';
import {
  levelCapturingLogger,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';
import {
  metersAllWet,
} from '@monochromatic-dev/translation-repair-provider/ts/meter-states.test-fixture.ts';
import { readJudgeSeats, } from '../../dist/final/node/index.mjs';

/**
 NeuralWatt and Bedrock wet and every other provider dry: the wide bench is 3 of 7 reachable against a quorum of 4.
 */
const WIDE_ONE_SHORT: BudgetView = {
  neuralwatt: false,
  synthetic: true,
  bedrock: false,
  deepseek: true,
  xiaomi: true,
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
  hyper: 0,
  openrouter: 0,
};

/**
 A hold short enough for a case to wait out on the real clock.
 */
const SHORT_HOLD_MS = 40;

/**
 NeuralWatt wet and every other provider dry: the wide bench is 1 of 7 reachable against a quorum of 4, three seats
 short. Hyper back alone reaches the quorum (4 of 6), and so do Synthetic and Bedrock back together (5 of 7), while
 Synthetic alone or Bedrock alone leaves it short (3 of 7): with the three held, each one is unnecessary given the
 others, yet every one of them adds a seat to the bench the held set cures.
 */
const WIDE_THREE_SHORT: BudgetView = {
  neuralwatt: false,
  synthetic: true,
  bedrock: true,
  deepseek: true,
  xiaomi: true,
  hyper: true,
  openrouter: true,
};

/**
 Reads one phase's seats over a scripted view under holds that all end with the first wait, counting the dryness reads.

 @param held - providers the holds are on, each for the short hold

 @param lines - receives what the reading logs

 @param view - dryness every read returns (the wide bench one seat short by default)

 @returns Dryness reads the reading took: 1 without a wait, 2 with one

 @example
 ```ts
 const reads = await readsUnderHolds({ held: ['deepseek',], lines: [], },);
 ```
 */
async function readsUnderHolds(
  {
    held,
    lines,
    view = WIDE_ONE_SHORT,
  }: {
    readonly held: readonly ProviderName[];
    readonly lines: string[];
    readonly view?: BudgetView;
  },
): Promise<number> {
  /**
   Reads taken so far, and how often the holds were asked (they end with the first wait).
   */
  const counted = { reads: 0, asks: 0, };
  await readJudgeSeats({
    client: {
      providerDryness: async () => {
        counted.reads += 1;
        return view;
      },
      providerMeterStates: metersAllWet,
      providerHolds: () => {
        counted.asks += 1;
        return (counted.asks === 1)
          ? providerRecord({
            of: function holdOf(provider,): number {
              return held.includes(provider,) ? SHORT_HOLD_MS : 0;
            },
          },)
          : NO_HOLDS;
      },
    },
    phase: 'lane contest',
    signal: new AbortController().signal,
    l: levelCapturingLogger({ lines, },),
    pollMs: 5,
  },);
  return counted.reads;
}

/**
 Reads the lane contest's seats over the one-short view under one hold, counting the dryness reads.

 @param held - provider the hold is on

 @param lines - receives what the reading logs

 @returns Dryness reads the reading took: 1 without a wait, 2 with one

 @example
 ```ts
 const reads = await readsUnderHold({ held: 'deepseek', lines: [], },);
 ```
 */
async function readsUnderHold(
  {
    held,
    lines,
  }: {
    readonly held: ProviderName;
    readonly lines: string[];
  },
): Promise<number> {
  return await readsUnderHolds({
    held: [held,],
    lines,
  },);
}

await describe({
  name: 'the seat reader and a hold whose provider cannot cure the short bench',
  concurrency: 1,
  children: [
    it({
      name: 'WAITS OUT A HOLD ON A PROVIDER WHOSE RETURN CURES THE SHORTFALL (the control): with Synthetic, Hyper or '
        + 'OpenRouter back the wide bench is 4 of 7 against a quorum of 4, so the wait buys the quorum',
      fn: async () => {
        expect(await readsUnderHold({ held: 'synthetic', lines: [], },),).toBe(2,);
        expect(await readsUnderHold({ held: 'hyper', lines: [], },),).toBe(2,);
        expect(await readsUnderHold({ held: 'openrouter', lines: [], },),).toBe(2,);
      },
    },),

    it({
      name: 'DOES NOT WAIT OUT A HOLD ON A PROVIDER WHOSE RETURN LEAVES THE BENCH SHORT: with DeepSeek or Xiaomi back '
        + 'the wide bench is still 3 of 7, so the wait buys nothing',
      fn: async () => {
        expect(await readsUnderHold({ held: 'deepseek', lines: [], },),).toBe(1,);
        expect(await readsUnderHold({ held: 'xiaomi', lines: [], },),).toBe(1,);
      },
    },),

    it({
      name: 'WAITS WHEN TWO HOLDS EACH CURE THE BENCH ALONE: Synthetic and Hyper both held, and either back makes the '
        + 'wide bench 4 of 7, so the wait is for the shorter of them',
      fn: async () => {
        expect(await readsUnderHolds({ held: ['synthetic', 'hyper',], lines: [], },),).toBe(2,);
      },
    },),

    it({
      name: 'WAITS WHEN SYNTHETIC AND OPENROUTER ARE BOTH HELD, each of which cures the wide bench alone',
      fn: async () => {
        expect(await readsUnderHolds({ held: ['synthetic', 'openrouter',], lines: [], },),).toBe(2,);
      },
    },),

    it({
      name: 'WAITS WHEN THREE HOLDS EACH LEAVE THE OTHERS ENOUGH: NeuralWatt wet makes the wide bench 1 of 7, Hyper '
        + 'cures it alone and Synthetic with Bedrock cure it together, so with all three held none is necessary '
        + 'and every one adds a seat',
      fn: async () => {
        expect(
          await readsUnderHolds({
            held: ['synthetic', 'bedrock', 'hyper',],
            lines: [],
            view: WIDE_THREE_SHORT,
          },),
        ).toBe(2,);
      },
    },),

    it({
      name: 'WAITS FOR SYNTHETIC ONLY WHEN DEEPSEEK IS HELD BESIDE IT: DeepSeek back adds no wide seat, so its hold is '
        + 'not one the wait counts, and the line names Synthetic as the hold waited for',
      fn: async () => {
        const lines: string[] = [];
        expect(await readsUnderHolds({ held: ['synthetic', 'deepseek',], lines, },),).toBe(2,);
        /**
         The line announcing the wait, which prints each provider's hold as the wait counts it.
         */
        const waiting = lines.find(function isWaiting(line,): boolean {
          return line.includes('waiting ',);
        },);
        expect(waiting,).toContain('synthetic 40ms',);
        expect(waiting,).toContain('deepseek 0ms',);
      },
    },),

    it({
      name: 'NAMES THE BENCH, THE COUNTS AND THE PROVIDERS THAT COULD CURE IT when it seats a bench short after the '
        + 'waits: the Synthetic hold is waited out, the view does not change, and the warning says wide 3 of 7, '
        + 'quorum 4, and that Synthetic, Hyper or OpenRouter back would reach it',
      fn: async () => {
        const lines: string[] = [];
        await readsUnderHold({ held: 'synthetic', lines, },);
        /**
         The warning the reading wrote once the waits were over.
         */
        const warning = lines.find(function isSeatedShort(line,): boolean {
          return line.startsWith('warn JUDGE SEATS phase=lane contest seated short',);
        },);
        expect(warning,).toContain('wide 3 of 7 reachable, quorum 4',);
        expect(warning,).toContain('synthetic, hyper, openrouter',);
        expect(warning,).not.toContain('deepseek',);
      },
    },),

    it({
      name: 'NAMES THE PROVIDERS THAT COULD CURE IT when no wait was taken either: the DeepSeek hold is not waited for '
        + 'and the short bench is seated short with the same warning',
      fn: async () => {
        const lines: string[] = [];
        await readsUnderHold({ held: 'deepseek', lines, },);
        /**
         The warning the reading wrote.
         */
        const warning = lines.find(function isShort(line,): boolean {
          return line.startsWith('warn JUDGE SEATS phase=lane contest',) && line.includes('short of quorum',);
        },);
        expect(warning,).toContain('synthetic, hyper, openrouter',);
      },
    },),
  ],
},);
