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

/** Cost ratio that accepts cheaper fixtures. */
const ACCEPTING_COST_RATIO = 0.5;

/** Cost ratio that rejects equal-threshold fixtures. */
const REJECTING_COST_RATIO = 0.1;

/** Major-version count used by budget selection fixtures. */
const MAJOR_VERSIONS = 1;

/** Fixture context window. */
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

/** Active model fixture used as cost-ratio reference. */
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

/** Any-provider budget candidate fixture. */
const anyProviderBudgetModel = modelFixture({
  provider: 'anthropic',
  id: 'claude-4-haiku',
  inputCost: ANY_PROVIDER_INPUT,
  outputCost: ANY_PROVIDER_OUTPUT,
},);

/** All registry models used by budget tests. */
const allModels = [
  activeModel,
  sameProviderBudgetModel,
  anyProviderBudgetModel,
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
  }: {
    readonly authenticatedSlugs: readonly string[];
  },
): ExtensionContext {
  /** Authenticated model slugs for O(1) lookup. */
  const authenticated = new Set(authenticatedSlugs,);
  /** Minimal registry surface used by budget-model helpers. */
  const modelRegistry = {
    getAll() {
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
    find(provider: string, id: string,) {
      return allModels.find(function matchesModel(model,) {
        return (model.provider === provider) && (model.id === id);
      },);
    },
  };

  return {
    model: activeModel,
    modelRegistry,
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
      name: 'keeps same-provider model choice for fixed fixtures',
      fn: async function testSameProviderSelection() {
        const budgetModel = await findBudgetModel({
          ctx: contextFixture({
            authenticatedSlugs: [slugFor(sameProviderBudgetModel,),],
          },),
          options: {
            strategy: 'same-provider',
            costRatio: ACCEPTING_COST_RATIO,
            majorVersions: MAJOR_VERSIONS,
          },
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
          options: {
            strategy: 'any-provider',
            costRatio: ACCEPTING_COST_RATIO,
            majorVersions: MAJOR_VERSIONS,
          },
        },);

        expect(slugFor(budgetModel.model,),).toBe(slugFor(anyProviderBudgetModel,),);
      },
    },),
    it({
      name: 'keeps no-auth error message shape',
      fn: async function testNoAuthErrorShape() {
        const caught = await captureError(async function selectWithoutAuth() {
          return await findBudgetModel({
            ctx: contextFixture({ authenticatedSlugs: [], },),
            options: {
              strategy: 'same-provider',
              costRatio: ACCEPTING_COST_RATIO,
              majorVersions: MAJOR_VERSIONS,
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'no API key available for cheapest models in provider "openai"',
        );
      },
    },),
    it({
      name: 'keeps too-expensive error message shape',
      fn: async function testTooExpensiveErrorShape() {
        const caught = await captureError(async function selectTooExpensiveModel() {
          return await findBudgetModel({
            ctx: contextFixture({
              authenticatedSlugs: [slugFor(sameProviderBudgetModel,),],
            },),
            options: {
              strategy: 'same-provider',
              costRatio: REJECTING_COST_RATIO,
              majorVersions: MAJOR_VERSIONS,
            },
          },);
        },);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'not significantly cheaper than active model',
        );
      },
    },),
  ],
},);
