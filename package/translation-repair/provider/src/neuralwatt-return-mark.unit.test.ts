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
