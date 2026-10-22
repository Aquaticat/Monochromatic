/**
 Tests for the mark that keeps when NeuralWatt's spent day starts again, beside the reading that named it.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createNeuralWattReturnMark, } from '../dist/final/node/index.mjs';
import { levelCapturingLogger, } from '@monochromatic-dev/translation-repair-test-fixture/ts/capturing-logger.test-fixture.ts';

await describe({
  name: createNeuralWattReturnMark.name,
  concurrency: 1,
  children: [
    it({
      name: 'NAMES NO RETURN UNTIL A READING NAMES ONE, and counts the wait down on the clock it is given',
      fn: async () => {
        const clock = { now: 1_000, };
        const mark = createNeuralWattReturnMark({ now: () => clock.now, boundMs: 300_000, },);
        expect([mark.passed(), mark.leftMs(),],).toEqual([false, 0,],);
        mark.replace({ returnsInMs: 48_000, },);
        expect([mark.passed(), mark.leftMs(),],).toEqual([false, 48_000,],);
        clock.now += 47_999;
        expect([mark.passed(), mark.leftMs(),],).toEqual([false, 1,],);
        clock.now += 1;
        expect([mark.passed(), mark.leftMs(),],).toEqual([true, 0,],);
      },
    },),

    it({
      name: 'COUNTS THE RETURN AS PASSED TWO MILLISECONDS EARLY, the slack for a timer that fires a hair before its time',
      fn: async () => {
        const clock = { now: 1_000, };
        const mark = createNeuralWattReturnMark({ now: () => clock.now, },);
        mark.replace({ dryness: { kind: 'spent-day', dayStart: '2026-10-23T19:15:08.000Z', returnsInMs: 48_000, }, },);
        clock.now += 47_997;
        expect(mark.passed(),).toBe(false,);
        clock.now += 1;
        expect(mark.passed(),).toBe(true,);
      },
    },),

    it({
      name: 'LOGS THE RETURN WHEN IT CHANGES AND NOT ON EVERY READING that names the same day start: a minute\'s '
        + 'readings repeat the line otherwise',
      fn: async () => {
        const lines: string[] = [];
        const clock = { now: 1_000, };
        const mark = createNeuralWattReturnMark({ now: () => clock.now, l: levelCapturingLogger({ lines, },), },);
        mark.replace({ dryness: { kind: 'spent-day', dayStart: '2026-10-23T19:15:08.000Z', returnsInMs: 48_000, }, },);
        clock.now += 1_000;
        mark.replace({ dryness: { kind: 'spent-day', dayStart: '2026-10-23T19:15:08.000Z', returnsInMs: 47_000, }, },);
        expect(lines.length,).toBe(1,);
        mark.replace({ dryness: { kind: 'wet', }, },);
        mark.replace({ dryness: { kind: 'spent-day', dayStart: '2026-10-24T19:15:08.000Z', returnsInMs: 86_000_000, }, },);
        expect(lines.length,).toBe(2,);
      },
    },),

    it({
      name: 'FORGETS THE RETURN WHEN THE NEXT READING NAMES NONE, so a return never outlives the reading that named it',
      fn: async () => {
        const mark = createNeuralWattReturnMark({ now: () => 1_000, boundMs: 300_000, },);
        mark.replace({ returnsInMs: 48_000, },);
        mark.replace({},);
        expect([mark.passed(), mark.leftMs(),],).toEqual([false, 0,],);
      },
    },),
  ],
},);
