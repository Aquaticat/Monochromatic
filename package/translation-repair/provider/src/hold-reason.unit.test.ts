/**
 Tests for the words a hold wait gives for waiting: which providers the shortest hold belongs to, and for NeuralWatt the
 time of day its day starts again.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  beyondBoundClauseOf,
  holdReasonOf,
  NEURALWATT_RETURN_WAIT_BOUND_MS,
} from '../dist/final/node/index.mjs';

/**
 Nobody held.
 */
const NO_HOLDS = {
  neuralwatt: 0,
  synthetic: 0,
  bedrock: 0,
  deepseek: 0,
  xiaomi: 0,
  hyper: 0,
  openrouter: 0,
} as const;

/**
 The account whose day starts at 19:15:08 UTC.
 */
const XINGZ_DAY = { kind: 'at', msOfDay: 69_308_000, } as const;

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: holdReasonOf.name,
      concurrency: 1,
      children: [
        it({
          name: 'NAMES NEURALWATT\'S DAY START when NeuralWatt holds the shortest hold, since that hold is its return and '
            + 'not a refusal',
          fn: async () => {
            expect(holdReasonOf({
              holds: { ...NO_HOLDS, neuralwatt: 48_000, hyper: 900_000, },
              neuralwatt: XINGZ_DAY,
            },),).toBe('neuralwatt, whose day starts again at 19:15:08 UTC',);
          },
        },),

        it({
          name: 'NAMES THE PROVIDERS THAT HOLD THE SHORTEST HOLD in spending order, and the refusals they stand for as '
            + 'plain names',
          fn: async () => {
            expect(holdReasonOf({
              holds: { ...NO_HOLDS, synthetic: 5_000, hyper: 5_000, openrouter: 9_000, },
              neuralwatt: XINGZ_DAY,
            },),).toBe('synthetic, hyper',);
          },
        },),

        it({
          name: 'NAMES NOBODY where nothing is held',
          fn: async () => {
            expect(holdReasonOf({ holds: NO_HOLDS, neuralwatt: XINGZ_DAY, },),).toBe('no provider',);
          },
        },),
      ],
    },),

    describe({
      name: beyondBoundClauseOf.name,
      concurrency: 1,
      children: [
        it({
          name: 'STATES THE DAY START AND THE BOUND for a run that decided one, so a refusal names when NeuralWatt '
            + 'returns and why it was not waited for',
          fn: async () => {
            expect(beyondBoundClauseOf({ neuralwatt: XINGZ_DAY, },),).toBe(
              'NeuralWatt reads dry and its day starts again at 19:15:08 UTC, which is past the '
                + `${String(NEURALWATT_RETURN_WAIT_BOUND_MS / 1_000,)} s this run waits for it`,
            );
          },
        },),

        it({
          name: 'SAYS NOTHING where the run decided no day start or NeuralWatt is off',
          fn: async () => {
            expect(beyondBoundClauseOf({ neuralwatt: { kind: 'unanchored', }, },),).toBe('',);
            expect(beyondBoundClauseOf({ neuralwatt: { kind: 'off', }, },),).toBe('',);
          },
        },),
      ],
    },),
  ],
},);
