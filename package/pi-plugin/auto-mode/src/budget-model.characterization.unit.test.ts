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
import {
  JUDGE_MODEL_MAJOR_VERSIONS,
  JUDGE_MODEL_STRATEGY,
} from './constants.ts';

//region Fixtures

/** Active model input token price. */
const ACTIVE_INPUT = 10;

/** Active model output token price. */
const ACTIVE_OUTPUT = 20;

/** Same-provider budget input token price. */
const SAME_PROVIDER_INPUT = 1;

/** Same-provider budget output token price. */
const SAME_PROVIDER_OUTPUT = 2;

/** Any-provider budget input token price. */
const ANY_PROVIDER_INPUT = 0.25;

/** Any-provider budget output token price. */
const ANY_PROVIDER_OUTPUT = 1;

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

/** Active model fixture used as same-provider reference. */
const activeModel = modelFixture({
  provider: 'openai',
  id: 'gpt-4o',
  inputCost: ACTIVE_INPUT,
  outputCost: ACTIVE_OUTPUT,
},);

/** Same-provider budget candidate fixture. */
const sameProviderBudgetModel = modelFixture({
  provider: 'openai',
  id: 'gpt-4o-mini',
  inputCost: SAME_PROVIDER_INPUT,
  outputCost: SAME_PROVIDER_OUTPUT,
},);

/** Same-provider fast candidate fixture. */
const sameProviderFastModel = modelFixture({
  provider: 'openai',
  id: 'gpt-4o-highspeed',
  inputCost: ACTIVE_INPUT,
  outputCost: ACTIVE_OUTPUT,
},);

/** Any-provider budget candidate fixture. */
const anyProviderBudgetModel = modelFixture({
  provider: 'anthropic',
  id: 'claude-4-haiku',
  inputCost: ANY_PROVIDER_INPUT,
  outputCost: ANY_PROVIDER_OUTPUT,
},);

/** Any-provider fast candidate fixture. */
const anyProviderFastModel = modelFixture({
  provider: 'moonshotai',
  id: 'kimi-k2.7-code-highspeed',
  inputCost: ACTIVE_INPUT,
  outputCost: ACTIVE_OUTPUT,
},);

/** All registry models used by budget tests. */
const allModels = [
  activeModel,
  sameProviderBudgetModel,
  sameProviderFastModel,
  anyProviderBudgetModel,
  anyProviderFastModel,
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
    hasConfiguredAuth(model: Model<Api>,) {
      return authenticated.has(slugFor(model,),);
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
              slugFor(sameProviderFastModel,),
              slugFor(anyProviderBudgetModel,),
            ],
            scopedModels: [anyProviderBudgetModel,],
          },),
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(anyProviderBudgetModel,),);
      },
    },),
    it({
      name: 'excludes failed model when selecting fallback',
      fn: async function testFailedModelExclusion() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [
              slugFor(sameProviderBudgetModel,),
              slugFor(sameProviderFastModel,),
            ],
          },),
          excludedModelSlugs: [slugFor(sameProviderFastModel,),],
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(sameProviderBudgetModel,),);
      },
    },),
    it({
      name: 'keeps any-provider model choice for fixed fixtures',
      fn: async function testAnyProviderSelection() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [slugFor(anyProviderBudgetModel,),],
          },),
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(anyProviderBudgetModel,),);
      },
    },),
    it({
      name: 'selects speed-named any-provider candidate before cheaper model',
      fn: async function testAnyProviderFastSelection() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [
              slugFor(anyProviderBudgetModel,),
              slugFor(anyProviderFastModel,),
            ],
          },),
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(anyProviderFastModel,),);
      },
    },),
    it({
      name: 'does not widen an unauthenticated scope to registry models',
      fn: async function testUnauthenticatedScopedSelection() {
        const caught = await captureError(async function selectOutsideScope() {
          return await findBudgetModel({
            ctx: contextFixture({
              authenticatedSlugs: [slugFor(sameProviderFastModel,),],
              scopedModels: [sameProviderBudgetModel,],
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
      name: 'uses fixed cross-provider selection policy',
      fn: async function testFixedSelectionPolicy() {
        expect(JUDGE_MODEL_STRATEGY,).toBe('any-provider',);
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
