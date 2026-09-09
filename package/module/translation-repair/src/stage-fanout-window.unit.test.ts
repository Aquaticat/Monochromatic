/**
 * Tests for the fan-out window: which seats a round asks first.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  askingWindow,
  benchRotation,
  FANOUT_SPARE,
  firstRoundWindow,
  type RosterModelId,
  rotatedBench,
} from '../dist/final/node/index.mjs';

/**
 * A seven-seat bench in roster order.
 */
const BENCH: readonly RosterModelId[] = [
  'hf:zai-org/GLM-5.3-Flash',
  'minimax-m3',
  'hf:Qwen/Qwen3.8-27B',
  'hf:moonshotai/Kimi-K3',
  'deepseek-v4-pro-0813',
  'deepseek-v4-flash-0731',
  'hf:openai/gpt-oss-120b',
];

await describe({
  name: benchRotation.name,
  children: [
    it({
      name: 'ROTATES deterministically by the prompt, within the bench, and differently for a different '
        + 'prompt at least somewhere, so a re-run asks the same seats and slices spread their first asks',
      fn: async () => {
        /**
         * Rotation for one prompt, read twice.
         */
        const first = benchRotation({ messages: [{ role: 'user', content: 'meow', },], size: 7, },);
        expect(first,).toBe(benchRotation({ messages: [{ role: 'user', content: 'meow', },], size: 7, },),);
        expect(first,).toBeGreaterThanOrEqual(0,);
        expect(first,).toBeLessThan(7,);
        /**
         * Rotations over many distinct prompts.
         */
        const seen = new Set(
          Array.from({ length: 40, }, function rotationOf(_,
            at,): number {
            return benchRotation({ messages: [{ role: 'user', content: `prompt ${String(at,)}`, },], size: 7, },);
          },),
        );
        expect(seen.size,).toBeGreaterThan(1,);
        expect(benchRotation({ messages: [], size: 0, },),).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: rotatedBench.name,
  children: [
    it({
      name: 'KEEPS every seat exactly once, starting at the prompt\'s rotation',
      fn: async () => {
        /**
         * Bench as one prompt orders it.
         */
        const order = rotatedBench({ modelIds: BENCH, messages: [{ role: 'user', content: 'meow', },], },);
        expect([...order,].toSorted(),).toEqual([...BENCH,].toSorted(),);
        /**
         * Where the rotation started.
         */
        const start = benchRotation({ messages: [{ role: 'user', content: 'meow', },], size: BENCH.length, },);
        expect(order[0],).toBe(BENCH[start],);
      },
    },),
  ],
},);

await describe({
  name: askingWindow.name,
  children: [
    it({
      name: 'TAKES what quorum still needs plus the spare from the front, never more than is pending, '
        + 'and the spare alone when nothing is needed',
      fn: async () => {
        expect(askingWindow({ pending: BENCH, needed: 4, },),).toEqual(BENCH.slice(0, 4 + FANOUT_SPARE,),);
        expect(askingWindow({ pending: BENCH.slice(0, 2,), needed: 4, },),).toEqual(BENCH.slice(0, 2,),);
        expect(askingWindow({ pending: BENCH, needed: 0, },),).toEqual(BENCH.slice(0, FANOUT_SPARE,),);
        expect(askingWindow({ pending: [], needed: 3, },),).toEqual([],);
      },
    },),
  ],
},);

await describe({
  name: firstRoundWindow.name,
  children: [
    it({
      name: 'COUNTS quorum plus the spare, capped at the bench, so six seats cost half plus the spare, '
        + 'three seats cost all three and an empty bench costs nothing',
      fn: async () => {
        expect(firstRoundWindow({ benchSize: 6, },),).toBe(3 + FANOUT_SPARE,);
        expect(firstRoundWindow({ benchSize: 4, },),).toBe(2 + FANOUT_SPARE,);
        expect(firstRoundWindow({ benchSize: 3, },),).toBe(3,);
        expect(firstRoundWindow({ benchSize: 0, },),).toBe(0,);
      },
    },),
  ],
},);
