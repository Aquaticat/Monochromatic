/**
 * Characterization tests for auto-mode budget-model selection before shared extraction.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { findBudgetModel, } from './budget-model.ts';
import { JUDGE_MODEL_MAJOR_VERSIONS, } from './constants.ts';

//region Fixtures

/** Active model input token price. */
const ACTIVE_INPUT = 10;

/** Active model output token price. */
const ACTIVE_OUTPUT = 20;

/** OpenAI budget input token price. */
const OPENAI_BUDGET_INPUT = 1;

/** OpenAI budget output token price. */
const OPENAI_BUDGET_OUTPUT = 2;

/** Anthropic budget input token price. */
const ANTHROPIC_BUDGET_INPUT = 0.25;

/** Anthropic budget output token price. */
const ANTHROPIC_BUDGET_OUTPUT = 1;

/** Fixture context budget. */
const CONTEXT_WINDOW = 128_000;

/** Fixture maximum output tokens. */
const MAX_TOKENS = 4_096;

/** Authentication fixture returned by fake registries. */
const apiKey = 'test-api-key';

/**
 * Build a complete pi model fixture.
 *
 * @param provider - provider slug
 *
 * @param id - model id
 *
 * @param inputCost - input token price per million tokens
 *
 * @param outputCost - output token price per million tokens
 *
 * @returns pi model fixture
 *
 * @example
 * ```typescript
 * modelFixture({ provider: 'openai', id: 'gpt-4o-mini', inputCost: 1, outputCost: 2 });
 * ```
 */
function modelFixture(
  {
    provider,
    id,
    inputCost,
    outputCost,
  }: {
    readonly provider: string;
    readonly id: string;
    readonly inputCost: number;
    readonly outputCost: number;
  },
): Model<Api> {
  return {
    id,
    name: id,
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

/** Active model fixture retained for host context. */
const activeModel = modelFixture({
  provider: 'openai',
  id: 'gpt-4o',
  inputCost: ACTIVE_INPUT,
  outputCost: ACTIVE_OUTPUT,
},);

/** OpenAI budget candidate fixture. */
const openAiBudgetModel = modelFixture({
  provider: 'openai',
  id: 'gpt-4o-mini',
  inputCost: OPENAI_BUDGET_INPUT,
  outputCost: OPENAI_BUDGET_OUTPUT,
},);

/** OpenAI fast candidate fixture. */
const openAiFastModel = modelFixture({
  provider: 'openai',
  id: 'gpt-4o-highspeed',
  inputCost: ACTIVE_INPUT,
  outputCost: ACTIVE_OUTPUT,
},);

/** Anthropic budget candidate fixture. */
const anthropicBudgetModel = modelFixture({
  provider: 'anthropic',
  id: 'claude-4-haiku',
  inputCost: ANTHROPIC_BUDGET_INPUT,
  outputCost: ANTHROPIC_BUDGET_OUTPUT,
},);

/** Moonshot fast candidate fixture. */
const moonshotFastModel = modelFixture({
  provider: 'moonshotai',
  id: 'kimi-k2.7-code-highspeed',
  inputCost: ACTIVE_INPUT,
  outputCost: ACTIVE_OUTPUT,
},);

/** All registry models used by budget tests. */
const allModels = [
  activeModel,
  openAiBudgetModel,
  openAiFastModel,
  anthropicBudgetModel,
  moonshotFastModel,
] as const;

/**
 * Return canonical provider/model slug for test registry lookups.
 *
 * @param model - model fixture
 *
 * @returns provider/model slug
 *
 * @example
 * ```typescript
 * slugFor(activeModel);
 * ```
 */
function slugFor(
  model: Model<Api>,
): string {
  return `${model.provider}/${model.id}`;
}

/**
 * Build a fake pi extension context with registry auth behavior.
 *
 * @param authenticatedSlugs - slugs whose registry auth succeeds
 *
 * @returns fake extension context
 *
 * @example
 * ```typescript
 * contextFixture({ authenticatedSlugs: ['openai/gpt-4o-mini'] });
 * ```
 */
function contextFixture(
  {
    authenticatedSlugs,
    scopedModels = allModels,
  }: {
    readonly authenticatedSlugs: readonly string[];
    readonly scopedModels?: readonly Model<Api>[];
  },
): ExtensionContext {
  /** Authenticated model slugs for O(1) lookup. */
  const authenticated = new Set(authenticatedSlugs,);
  /** Minimal registry surface used by budget-model helpers. */
  const modelRegistry = {
    getAll() {
      return allModels;
    },
    getAvailable() {
      return allModels;
    },
    async getApiKeyAndHeaders(model: Model<Api>,) {
      return authenticated.has(slugFor(model,),)
        ? {
          ok: true,
          apiKey,
        }
        : { ok: false, };
    },
  };

  return {
    model: activeModel,
    modelRegistry,
    getScopedModels() {
      return scopedModels;
    },
  } as unknown as ExtensionContext;
}

/**
 * Capture an async error without promise matcher indirection.
 *
 * @param action - async action expected to throw
 *
 * @returns caught error value
 *
 * @example
 * ```typescript
 * const error = await captureError(async function fail() { throw new Error('x'); });
 * ```
 */
async function captureError(
  action: () => Promise<unknown>,
): Promise<unknown> {
  try {
    await action();
  }
  catch (error) {
    return error;
  }
  throw new Error('expected action to throw',);
}

//endregion Fixtures

await describe({
  name: findBudgetModel.name,
  children: [
    it({
      name: 'uses scoped models across providers by default',
      fn: async function testScopedCrossProviderSelection() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [
              slugFor(openAiFastModel,),
              slugFor(anthropicBudgetModel,),
            ],
            scopedModels: [anthropicBudgetModel,],
          },),
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(anthropicBudgetModel,),);
      },
    },),
    it({
      name: 'excludes failed model when selecting fallback',
      fn: async function testFailedModelExclusion() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [
              slugFor(openAiBudgetModel,),
              slugFor(openAiFastModel,),
            ],
          },),
          excludedModelSlugs: [slugFor(openAiFastModel,),],
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(openAiBudgetModel,),);
      },
    },),
    it({
      name: 'selects authenticated model across providers',
      fn: async function testCrossProviderSelection() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [slugFor(anthropicBudgetModel,),],
          },),
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(anthropicBudgetModel,),);
      },
    },),
    it({
      name: 'selects speed-named cross-provider candidate before cheaper model',
      fn: async function testCrossProviderFastSelection() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [
              slugFor(anthropicBudgetModel,),
              slugFor(moonshotFastModel,),
            ],
          },),
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(moonshotFastModel,),);
      },
    },),
    it({
      name: 'does not widen an unauthenticated scope to registry models',
      fn: async function testUnauthenticatedScopedSelection() {
        const caught = await captureError(async function selectOutsideScope() {
          return await findBudgetModel({
            ctx: contextFixture({
              authenticatedSlugs: [slugFor(openAiFastModel,),],
              scopedModels: [openAiBudgetModel,],
            },),
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'no fast judge models with API keys found across any provider',
        );
      },
    },),
    it({
      name: 'uses fixed major-version family count',
      fn: async function testFixedMajorVersionCount() {
        expect(JUDGE_MODEL_MAJOR_VERSIONS,).toBe(1,);
      },
    },),
    it({
      name: 'keeps no-auth error message shape',
      fn: async function testNoAuthErrorShape() {
        const caught = await captureError(async function selectWithoutAuth() {
          return await findBudgetModel({
            ctx: contextFixture({ authenticatedSlugs: [], },),
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'no fast judge models with API keys found across any provider',
        );
      },
    },),
  ],
},);
