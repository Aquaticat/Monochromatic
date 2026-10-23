/**
 Tests for the refusal a seat reading stops the entry with: the writing-bench error, or the router's every-provider-dry
 refusal when every provider reads dry.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BudgetView,
  EveryProviderDryError,
} from '@monochromatic-dev/translation-repair-provider';
import { failureWritten, } from '@monochromatic-dev/translation-repair-stage';
import {
  WritingBenchUnreachableError,
  writtenRefusal,
} from '../../dist/final/node/index.mjs';

/**
 Every provider dry.
 */
const ALL_DRY: BudgetView = {
  neuralwatt: true,
  synthetic: true,
  bedrock: true,
  deepseek: true,
  xiaomi: true,
  hyper: true,
  openrouter: true,
};

/**
 Bedrock alone wet.
 */
const BEDROCK_WET: BudgetView = { ...ALL_DRY, bedrock: false, };

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

await describe({
  name: writtenRefusal.name,
  children: [
    it({
      name: 'BUILDS THE EVERY-PROVIDER-DRY REFUSAL when every provider reads dry, stating the reading, the holds and '
        + 'the NeuralWatt day start the client reports, and marks it written',
      fn: async () => {
        /**
         The refusal for a lanes reading on a fully dry view.
         */
        const refusal = writtenRefusal({
          phase: 'lanes',
          clauses: ['editors 0 of 3 reachable, floor 2',],
          dry: ALL_DRY,
          client: {
            providerHolds: () => NO_HOLDS,
            neuralwattReturn: () => ({ kind: 'at', msOfDay: 69_308_000, }),
          },
        },);
        expect(refusal,).toBeInstanceOf(EveryProviderDryError,);
        expect(refusal.message,).toContain('the seat reading for lanes read neuralwatt dry, synthetic dry',);
        expect(refusal.message,).toContain('holds neuralwatt 0ms',);
        expect(refusal.message,).toContain('at 19:15:08 UTC',);
        expect(failureWritten({ error: refusal, },),).toBe(true,);
      },
    },),

    it({
      name: 'LEAVES THE NEURALWATT DAY UNDECIDED when the client reports none, rather than inventing one',
      fn: async () => {
        /**
         The refusal for a client with no NeuralWatt accessor.
         */
        const refusal = writtenRefusal({
          phase: 'lanes',
          clauses: [],
          dry: ALL_DRY,
          client: { providerHolds: () => NO_HOLDS, },
        },);
        expect(refusal.message,).toContain('no time of day can be stated',);
      },
    },),

    it({
      name: 'BUILDS THE WRITING-BENCH ERROR when any provider reads wet, with the clauses, marked written',
      fn: async () => {
        /**
         The refusal for a lanes reading with Bedrock still wet.
         */
        const refusal = writtenRefusal({
          phase: 'lanes',
          clauses: ['editors 0 of 3 reachable, floor 2',],
          dry: BEDROCK_WET,
          client: { providerHolds: () => NO_HOLDS, },
        },);
        expect(refusal,).toBeInstanceOf(WritingBenchUnreachableError,);
        expect(refusal.message,).toContain('editors 0 of 3 reachable, floor 2',);
        expect(failureWritten({ error: refusal, },),).toBe(true,);
      },
    },),
  ],
},);
