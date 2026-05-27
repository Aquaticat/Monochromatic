/**
 * Unit tests for core Advisor helpers.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';

import { resolveRequestedModel, } from '@monochromatic-dev/pi-shared-model-selection/core';
import {
  selectDefaultModel,
  selectDefaultModelFromContextEstimates,
} from '@monochromatic-dev/pi-shared-model-selection/cost';
import {
  parseArgvModelPatterns,
  resolveModelPatterns,
} from '@monochromatic-dev/pi-shared-model-selection/scope';
import { prepareAdvisorArguments, } from './tool-params.ts';
import type { EffectiveModelScope, } from './types.ts';

//region Test fixtures

/** Cheap input token price for fixture models. */
const CHEAP_INPUT = 1;

/** Cheap output token price for fixture models. */
const CHEAP_OUTPUT = 2;

/** Expensive input token price for fixture models. */
const EXPENSIVE_INPUT = 3;

/** Expensive output token price for fixture models. */
const EXPENSIVE_OUTPUT = 5;

/** Small output token budget used in cost-selection tests. */
const OUTPUT_BUDGET = 10;

/** Input token estimate used in cost-selection tests. */
const INPUT_TOKENS = 20;

/** Large input token estimate used for per-model cost-selection tests. */
const LARGE_INPUT_TOKENS = 1_000;

/** Empty input token estimate used for per-model cost-selection tests. */
const EMPTY_INPUT_TOKENS = 0;

/** Context window for fixture models. */
const CONTEXT_WINDOW = 1_000;

/** Max output tokens for fixture models. */
const MAX_TOKENS = 100;

/**
 * Build a fixture pi model.
 *
 * @param provider - provider slug
 *
 * @param id - model id
 *
 * @param name - model display name
 *
 * @param inputCost - input token price
 *
 * @param outputCost - output token price
 *
 * @returns fixture model
 */
function fixtureModel(
  {
    provider,
    id,
    name,
    inputCost,
    outputCost,
  }: {
    provider: string;
    id: string;
    name: string;
    inputCost: number;
    outputCost: number;
  },
): Model<Api> {
  return {
    id,
    name,
    api: 'faux',
    provider,
    baseUrl: 'https://example.invalid',
    reasoning: false,
    input: ['text',],
    cost: {
      input: inputCost,
      output: outputCost,
      cacheRead: 0,
      cacheWrite: 0,
    },
    contextWindow: CONTEXT_WINDOW,
    maxTokens: MAX_TOKENS,
  } satisfies Model<Api>;
}

/** Cheap fixture model. */
const cheapModel = fixtureModel({
  provider: 'cheap',
  id: 'reviewer',
  name: 'Reviewer Cheap',
  inputCost: CHEAP_INPUT,
  outputCost: CHEAP_OUTPUT,
},);

/** Expensive fixture model. */
const expensiveModel = fixtureModel({
  provider: 'expensive',
  id: 'reviewer',
  name: 'Reviewer Expensive',
  inputCost: EXPENSIVE_INPUT,
  outputCost: EXPENSIVE_OUTPUT,
},);

/** Effective scope containing both fixture models. */
const twoModelScope: EffectiveModelScope = {
  source: 'available',
  entries: [
    {
      model: cheapModel,
      canonicalSlug: 'cheap/reviewer',
    },
    {
      model: expensiveModel,
      canonicalSlug: 'expensive/reviewer',
    },
  ],
};

/** Minimal model registry for slug validation tests. */
const modelRegistry = {
  getAll() {
    return [
      cheapModel,
      expensiveModel,
    ];
  },
} as ModelRegistry;

//endregion Test fixtures

await describe({
  name: '',
  children: [
    describe({
      name: parseArgvModelPatterns.name,
      children: [
        it({
          name: 'parses comma-separated --models argument',
          fn: async () => {
            expect(parseArgvModelPatterns({
              argv: [
                'pi',
                '--models',
                'cheap/*, expensive/reviewer ',
              ],
            },),)
              .toEqual([
                'cheap/*',
                'expensive/reviewer',
              ],);
          },
        },),
      ],
    },),
    describe({
      name: resolveModelPatterns.name,
      children: [
        it({
          name: 'resolves glob patterns against canonical slugs',
          fn: async () => {
            const result = resolveModelPatterns({
              patterns: ['expensive/*',],
              availableModels: [
                cheapModel,
                expensiveModel,
              ],
            },);
            expect(result.map(function mapEntry(entry,) {
              return entry.canonicalSlug;
            },),)
              .toEqual(['expensive/reviewer',],);
          },
        },),
      ],
    },),
    describe({
      name: resolveRequestedModel.name,
      children: [
        it({
          name: 'accepts canonical scoped slug',
          fn: async () => {
            const result = resolveRequestedModel({
              scope: twoModelScope,
              requestedSlug: 'expensive/reviewer',
              modelRegistry,
              errorPrefix: 'advisor',
            },);
            expect(result.selected.canonicalSlug,).toBe('expensive/reviewer',);
          },
        },),
        it({
          name: 'rejects ambiguous bare id',
          fn: async () => {
            let caught: unknown;
            try {
              resolveRequestedModel({
                scope: twoModelScope,
                requestedSlug: 'reviewer',
                modelRegistry,
                errorPrefix: 'advisor',
              },);
            }
            catch (error) {
              caught = error;
            }
            expect(caught,).toBeInstanceOf(Error,);
            expect((caught as Error).message,).toContain('ambiguous',);
          },
        },),
      ],
    },),
    describe({
      name: selectDefaultModel.name,
      children: [
        it({
          name: 'selects highest expected-cost model',
          fn: async () => {
            const result = selectDefaultModel({
              scope: twoModelScope,
              estimatedInputTokens: INPUT_TOKENS,
              maxOutputTokens: OUTPUT_BUDGET,
            },);
            expect(result.selected.canonicalSlug,).toBe('expensive/reviewer',);
          },
        },),
      ],
    },),
    describe({
      name: selectDefaultModelFromContextEstimates.name,
      children: [
        it({
          name: 'scores each model with its own input-token estimate',
          fn: async () => {
            const result = selectDefaultModelFromContextEstimates({
              scope: twoModelScope,
              estimatedInputTokensBySlug: new Map([
                [
                  'cheap/reviewer',
                  LARGE_INPUT_TOKENS,
                ],
                [
                  'expensive/reviewer',
                  EMPTY_INPUT_TOKENS,
                ],
              ],),
              maxOutputTokens: OUTPUT_BUDGET,
            },);
            expect(result.selected.canonicalSlug,).toBe('cheap/reviewer',);
          },
        },),
      ],
    },),
    describe({
      name: prepareAdvisorArguments.name,
      children: [
        it({
          name: 'normalizes raw string arguments',
          fn: async () => {
            expect(prepareAdvisorArguments('expensive/reviewer',),).toEqual({
              model: 'expensive/reviewer',
            },);
          },
        },),
      ],
    },),
  ],
},);
