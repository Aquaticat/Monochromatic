/**
 * Budget model: auto-select the fastest available judge model.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  budgetModelSlug,
  NoBudgetModelError,
  resolveEffectiveScope,
  selectBudgetModel,
} from '@monochromatic-dev/pi-shared-model-selection/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  hasRegistryBudgetAuth,
  resolveBudgetAuth,
} from './budget-model-auth.ts';
import {
  JUDGE_MODEL_MAJOR_VERSIONS,
  JUDGE_MODEL_STRATEGY,
} from './constants.ts';
import type { BudgetModel, } from './types.ts';

//region Model shape guards

/**
 * Detect the structural pi model fields used by budget selection and auth callbacks.
 *
 * @param value - value to inspect
 *
 * @returns whether value has the needed pi model fields
 */
function isModelApi(
  value: unknown,
): value is Model<Api> {
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  if (!('cost' in value))
    return false;
  /**
   * Cost object inspected separately so nested price fields stay type-safe.
   */
  const { cost, } = value;
  if ((cost === null) || ((typeof cost) !== 'object'))
    return false;
  return ('id' in value)
    && ((typeof value.id) === 'string')
    && ('name' in value)
    && ((typeof value.name) === 'string')
    && ('provider' in value)
    && ((typeof value.provider) === 'string')
    && ('api' in value)
    && ((typeof value.api) === 'string')
    && ('baseUrl' in value)
    && ((typeof value.baseUrl) === 'string')
    && ('reasoning' in value)
    && ((typeof value.reasoning) === 'boolean')
    && ('input' in value)
    && Array.isArray(value.input,)
    && ('contextWindow' in value)
    && ((typeof value.contextWindow) === 'number')
    && ('maxTokens' in value)
    && ((typeof value.maxTokens) === 'number')
    && ('input' in cost)
    && ((typeof cost.input) === 'number')
    && ('output' in cost)
    && ((typeof cost.output) === 'number')
    && ('cacheRead' in cost)
    && ((typeof cost.cacheRead) === 'number')
    && ('cacheWrite' in cost)
    && ((typeof cost.cacheWrite) === 'number');
}

/**
 * Assert that a value has the pi model shape auto-mode budget selection needs.
 *
 * @param value - value to inspect
 *
 * @throws {@link NoBudgetModelError} when value is not a pi model
 *
 * @returns nothing when value has the required shape
 */
function assertModelApi(
  value: unknown,
): asserts value is Model<Api> {
  if (!isModelApi(value,)) {
    throw new NoBudgetModelError(
      'budget model selection received an invalid active model shape',
    );
  }
}

/**
 * Assert that a value is a list of pi models auto-mode budget selection can inspect.
 *
 * @param value - value to inspect
 *
 * @throws {@link NoBudgetModelError} when value is not a pi model list
 *
 * @returns nothing when value has the required shape
 */
function assertModelApiList(
  value: unknown,
): asserts value is readonly Model<Api>[] {
  if ((!Array.isArray(value,))
    || (!value.every(function registryModelHasShape(model,) {
      return isModelApi(model,);
    },))) {
    throw new NoBudgetModelError(
      'budget model selection received an invalid registry model shape',
    );
  }
}

//endregion Model shape guards

//region Public API

/**
 * Find the fastest available model for the judge.
 *
 * Validates the active model and registry with {@link assertModelApi} and
 * {@link assertModelApiList}, then {@link resolveEffectiveScope} narrows
 * automatic candidates to Pi's effective scoped models.
 * {@link selectBudgetModel} walks those candidates fastest-first using
 * {@link hasRegistryBudgetAuth} and {@link resolveBudgetAuth}, and returns
 * the first candidate the registry can authenticate.
 *
 * @param ctx - pi extension context
 *
 * @param excludedModelSlugs - models whose completed attempts must not be selected again
 *
 * @throws {@link NoBudgetModelError} if no suitable model is found
 *
 * @returns budget model with auth credentials
 *
 * @mutates ctx - scope resolution and registry selection can invoke model accessors and command-backed auth capabilities
 *
 * @mutates excludedModelSlugs - iteration can invoke caller-owned iterator hooks
 *
 * @example
 * ```typescript
 * const budget = await findBudgetModel({ ctx });
 * ```
 */
async function findBudgetModel(
  {
    ctx,
    excludedModelSlugs = [],
  }: {
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly excludedModelSlugs?: readonly string[];
  },
): Promise<BudgetModel> {
  /**
   * Canonical slugs excluded after earlier judge attempts exhausted their retries.
   */
  const excludedSlugs = new Set(excludedModelSlugs,);

  if ((ctx.model
    === undefined) || (ctx.model
      === null))
    throw new NoBudgetModelError('no active model set',);

  /**
   * Active model handed in by host for shared selection context.
   */
  const rawActiveModel: unknown = ctx.model;
  assertModelApi(rawActiveModel,);
  /**
   * Active model after runtime shape validation.
   */
  const activeModel = rawActiveModel;
  /**
   * Effective Pi scope that constrains automatic judge selection.
   */
  const judgeModelScope = await resolveEffectiveScope<Model<Api>>({
    ctx,
    errorPrefix: 'auto-mode',
  },);
  /**
   * Models selected by Pi's scope, narrowed to auto-mode's pi model shape.
   */
  const rawScopedJudgeModels: unknown = judgeModelScope
    .entries
    .map(
      /**
       * Extract model record from one effective-scope entry.
       *
       * @param entry - scoped Pi model entry
       *
       * @returns Pi model selected by scope
       */
      function mapScopedJudgeModel(
        entry: ForeignBorrowed<(typeof judgeModelScope.entries)[number]>,
      ) {
        return entry.model;
      },
    );
  assertModelApiList(rawScopedJudgeModels,);
  /**
   * Scoped models after runtime shape validation, excluding models whose
   * completed judge attempts already failed.
   */
  const allModels = rawScopedJudgeModels.filter(
    /**
     * Excludes models whose previous judge attempts failed.
     *
     * @param model - Registry model whose identity is inspected.
     *
     * @returns Whether model remains eligible.
     *
     */
    function modelHasNotFailed(model: ForeignBorrowed<Model<Api>>,) {
      return !excludedSlugs.has(budgetModelSlug(model,),);
    },
  );

  return await selectBudgetModel<Model<Api>>({
    activeModel,
    allModels,
    strategy: JUDGE_MODEL_STRATEGY,
    majorVersions: JUDGE_MODEL_MAJOR_VERSIONS,
    /**
     * Resolves auth for one automatically selected model.
     *
     * @param model - Registry model selected by strategy.
     *
     * @returns Resolved auth or no-auth sentinel.
     *
     * @mutates model - `resolveBudgetAuth` can invoke model hooks and command-backed auth.
     */
    async resolveAuth({ model, }: { readonly model: ForeignBorrowed<Model<Api>>; },) {
      return await resolveBudgetAuth({
        ctx,
        model,
      },);
    },
    /**
     * Checks registry auth availability for one candidate model.
     *
     * @param model - Registry model inspected by auth storage.
     *
     * @returns Whether registry auth is available.
     *
     * @mutates model - registry auth reads can invoke caller-owned model hooks.
     */
    hasConfiguredAuth({ model, }: { readonly model: ForeignBorrowed<Model<Api>>; },) {
      return hasRegistryBudgetAuth({
        ctx,
        model,
      },);
    },
  },);
}

//endregion Public API

export { NoBudgetModelError, } from '@monochromatic-dev/pi-shared-model-selection/ts';
export { findBudgetModel, };
