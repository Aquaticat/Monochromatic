/**
 * Tests for the completion cap every client sends as `max_tokens`.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  COMPLETION_CAP,
  completionCapFor,
  ROSTER_MODEL_IDS,
} from '../dist/final/node/index.mjs';

await describe({
  name: completionCapFor.name,
  children: [
    it({
      name: 'CARRIES a measured cap for every roster seat, so no client can send a call without one',
      fn: async () => {
        expect(Object.keys(COMPLETION_CAP,).toSorted(),).toEqual([...ROSTER_MODEL_IDS,].toSorted(),);
        for (const modelId of ROSTER_MODEL_IDS)
          expect(completionCapFor({ modelId, },),).toBeGreaterThan(0,);
      },
    },),
    it({
      name: 'LOWERS to a caller\'s own ceiling and never raises to one, since the cap is the bound that '
        + 'holds where a cancel does not',
      fn: async () => {
        /**
         * Measured cap for one seat.
         */
        const cap = COMPLETION_CAP['deepseek-v4-pro-0813'];
        expect(completionCapFor({ modelId: 'deepseek-v4-pro-0813', requested: cap - 1, },),).toBe(cap - 1,);
        expect(completionCapFor({ modelId: 'deepseek-v4-pro-0813', requested: cap + 1, },),).toBe(cap,);
      },
    },),
  ],
},);
