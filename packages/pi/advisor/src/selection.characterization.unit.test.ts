/**
 * Characterization tests for Advisor model-selection behavior before shared extraction.
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

import { selectAdvisorModel, } from './advisor-selection.ts';
import type {
  AdvisorConfig,
  EffectiveModelScope,
} from './types.ts';

//region Fixtures

/** Cheap model input token price. */
const CHEAP_INPUT = 1;

/** Cheap model output token price. */
const CHEAP_OUTPUT = 2;

/** Expensive model input token price. */
const EXPENSIVE_INPUT = 4;

/** Expensive model output token price. */
const EXPENSIVE_OUTPUT = 8;

/** Third model input token price. */
const THIRD_INPUT = 3;

/** Third model output token price. */
const THIRD_OUTPUT = 6;

/** Advisor output token budget used by selection tests. */
const ADVISOR_OUTPUT_TOKENS = 32;

/** Advisor input token estimate used by selection tests. */
const ADVISOR_INPUT_TOKENS = 16;

/** Fixture context window. */
const CONTEXT_WINDOW = 4_096;

/** Fixture maximum output tokens. */
const MAX_TOKENS = 512;

/** Runtime Advisor config fixture. */
const advisorConfig: AdvisorConfig = {
  enabled: true,
  timeoutMs: 1_000,
  maxAdvisorOutputTokens: ADVISOR_OUTPUT_TOKENS,
  includePriorAdvisorResults: true,
  source: {
    globalPath: '/tmp/global.json',
    projectPath: '/tmp/project.json',
    globalLoaded: false,
    projectLoaded: false,
  },
};

/**
 * Build a complete pi model fixture.
 *
 * @param provider - provider slug
 *
 * @param id - model id
 *
 * @param name - display name
 *
 * @param inputCost - input price per million tokens
 *
 * @param outputCost - output price per million tokens
 *
 * @returns pi model fixture
 *
 * @example
 * ```typescript
 * modelFixture({ provider: 'openai', id: 'gpt-5', name: 'GPT', inputCost: 1, outputCost: 2 });
 * ```
 */
function modelFixture(
  {
    provider,
    id,
    name,
    inputCost,
    outputCost,
  }: {
    readonly provider: string;
    readonly id: string;
    readonly name: string;
    readonly inputCost: number;
    readonly outputCost: number;
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

/** Cheap scoped model fixture. */
const cheapModel = modelFixture({
  provider: 'cheap',
  id: 'reviewer',
  name: 'Reviewer Cheap',
  inputCost: CHEAP_INPUT,
  outputCost: CHEAP_OUTPUT,
},);

/** Expensive scoped model fixture. */
const expensiveModel = modelFixture({
  provider: 'expensive',
  id: 'reviewer',
  name: 'Reviewer Expensive',
  inputCost: EXPENSIVE_INPUT,
  outputCost: EXPENSIVE_OUTPUT,
},);

/** Registry-only model fixture used to distinguish out-of-scope from unknown slugs. */
const thirdModel = modelFixture({
  provider: 'third',
  id: 'reviewer',
  name: 'Reviewer Third',
  inputCost: THIRD_INPUT,
  outputCost: THIRD_OUTPUT,
},);

/** Effective scope fixture with ambiguous bare ids. */
const scope: EffectiveModelScope = {
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

/** Model registry fixture exposing scoped plus out-of-scope models. */
const modelRegistry = {
  getAll() {
    return [
      cheapModel,
      expensiveModel,
      thirdModel,
    ];
  },
} as ModelRegistry;

/**
 * Capture a synchronous error from a selection action.
 *
 * @param action - action expected to throw
 *
 * @returns caught error value
 *
 * @example
 * ```typescript
 * const error = captureError(function fail() { throw new Error('x'); });
 * ```
 */
function captureError(
  action: () => unknown,
): unknown {
  try {
    action();
  }
  catch (error) {
    return error;
  }
  throw new Error('expected action to throw',);
}

//endregion Fixtures

await describe({
  name: selectAdvisorModel.name,
  children: [
    it({
      name: 'keeps default selection slug and ranking order for fixed fixtures',
      fn: async function testDefaultSelectionShape() {
        const result = selectAdvisorModel({
          scope,
          config: advisorConfig,
          estimatedInputTokens: ADVISOR_INPUT_TOKENS,
          modelRegistry,
        },);

        expect(result.selected.canonicalSlug,).toBe('expensive/reviewer',);
        expect(
          result.defaultSelection?.ranking.map(function mapScore(score,) {
            return score.slug;
          },),
        )
          .toEqual([
            'expensive/reviewer',
            'cheap/reviewer',
          ],);
      },
    },),
    it({
      name: 'keeps ambiguous bare-id error shape',
      fn: async function testAmbiguousBareIdErrorShape() {
        const caught = captureError(function selectAmbiguousBareId() {
          return selectAdvisorModel({
            scope,
            requestedSlug: 'reviewer',
            config: advisorConfig,
            estimatedInputTokens: ADVISOR_INPUT_TOKENS,
            modelRegistry,
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('ambiguous in scoped models',);
      },
    },),
    it({
      name: 'keeps out-of-scope slug error shape',
      fn: async function testOutOfScopeSlugErrorShape() {
        const caught = captureError(function selectOutOfScopeSlug() {
          return selectAdvisorModel({
            scope,
            requestedSlug: 'third/reviewer',
            config: advisorConfig,
            estimatedInputTokens: ADVISOR_INPUT_TOKENS,
            modelRegistry,
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('is not in scoped models',);
      },
    },),
    it({
      name: 'keeps unknown slug error shape',
      fn: async function testUnknownSlugErrorShape() {
        const caught = captureError(function selectUnknownSlug() {
          return selectAdvisorModel({
            scope,
            requestedSlug: 'missing/reviewer',
            config: advisorConfig,
            estimatedInputTokens: ADVISOR_INPUT_TOKENS,
            modelRegistry,
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('was not found in scoped models',);
      },
    },),
  ],
},);
