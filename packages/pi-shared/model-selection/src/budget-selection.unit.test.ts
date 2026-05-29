/**
 * Unit tests for budget-model strategy selection.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { ABSENT, } from './core.ts';
import {
  NoBudgetModelError,
  selectBudgetModel,
} from './budget.ts';
import {
  captureAsyncError,
  fixtureModel,
  fixtureSlug,
} from './test-fixtures.ts';
import type { BudgetModelAuth, } from './types.ts';

//region Fixtures

/** Active model fixture. */
const activeModel = fixtureModel({
  provider: 'openai',
  id: 'gpt-4o',
  inputCost: 10,
},);

/** Same-provider budget model fixture. */
const sameProviderModel = fixtureModel({
  provider: 'openai',
  id: 'gpt-4o-mini',
  inputCost: 1,
},);

/** Any-provider budget model fixture. */
const anyProviderModel = fixtureModel({
  provider: 'anthropic',
  id: 'claude-4-haiku',
  inputCost: 0.25,
},);

/** All budget test models. */
const allModels = [
  activeModel,
  sameProviderModel,
  anyProviderModel,
] as const;

/** Auth fixture. */
const auth: BudgetModelAuth = { apiKey: 'test-key', };

/**
 * Build authenticated slug callbacks for budget tests.
 *
 * @param authenticatedSlugs - slugs that should resolve auth
 *
 * @returns auth callbacks for shared budget selection
 */
function authCallbacks(
  authenticatedSlugs: readonly string[],
): Pick<Parameters<typeof selectBudgetModel>[0], 'resolveAuth' | 'hasConfiguredAuth'> {
  /** Authenticated slug set. */
  const slugs = new Set(authenticatedSlugs,);
  return {
    async resolveAuth({ model, },) {
      return slugs.has(fixtureSlug(model,),)
        ? auth
        : ABSENT;
    },
    hasConfiguredAuth({ model, },) {
      return slugs.has(fixtureSlug(model,),);
    },
  };
}

//endregion Fixtures

await describe({
  name: selectBudgetModel.name,
  children: [
    it({
      name: 'selects same-provider candidate with auth',
      fn: async function testSameProviderBudgetSelection() {
        const selected = await selectBudgetModel({
          activeModel,
          allModels,
          strategy: 'same-provider',
          costRatio: 0.5,
          majorVersions: 1,
          ...authCallbacks([fixtureSlug(sameProviderModel,),],),
        },);
        expect(selected.model,).toBe(sameProviderModel,);
      },
    },),
    it({
      name: 'selects any-provider candidate with auth',
      fn: async function testAnyProviderBudgetSelection() {
        const selected = await selectBudgetModel({
          activeModel,
          allModels,
          strategy: 'any-provider',
          costRatio: 0.5,
          majorVersions: 1,
          ...authCallbacks([fixtureSlug(anyProviderModel,),],),
        },);
        expect(selected.model,).toBe(anyProviderModel,);
      },
    },),
    it({
      name: 'throws no-auth and too-expensive error shapes',
      fn: async function testBudgetSelectionErrors() {
        const noAuth = await captureAsyncError(async function selectWithoutAuth() {
          return await selectBudgetModel({
            activeModel,
            allModels,
            strategy: 'same-provider',
            costRatio: 0.5,
            majorVersions: 1,
            ...authCallbacks([],),
          },);
        },);
        const tooExpensive = await captureAsyncError(async function selectTooExpensive() {
          return await selectBudgetModel({
            activeModel,
            allModels,
            strategy: 'same-provider',
            costRatio: 0.1,
            majorVersions: 1,
            ...authCallbacks([fixtureSlug(sameProviderModel,),],),
          },);
        },);
        expect(noAuth,).toBeInstanceOf(NoBudgetModelError,);
        expect((noAuth as Error).message,).toContain('no API key available',);
        expect(tooExpensive,).toBeInstanceOf(NoBudgetModelError,);
        expect((tooExpensive as Error).message,).toContain('not significantly cheaper',);
      },
    },),
  ],
},);
