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
  resolveBudgetModelOverride,
  selectBudgetModel,
} from '@monochromatic-dev/pi-shared-model-selection/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  findBudgetOverrideModel,
  hasConfiguredBudgetAuth,
  resolveBudgetAuth,
} from './budget-model-auth.ts';
import { JUDGE_MODEL_DEFAULTS, } from './constants.ts';
import type {
  BudgetModel,
  BudgetModelOptions,
} from './types.ts';

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
 * If `options.modelOverride` is set, resolves it through
 * {@link resolveBudgetModelOverride}, backed by {@link findBudgetOverrideModel}
 * and {@link resolveBudgetAuth}. Otherwise validates the active model and
 * registry with {@link assertModelApi} and {@link assertModelApiList}, then
 * {@link selectBudgetModel} walks candidate models fastest-first, using
 * {@link hasConfiguredBudgetAuth} and {@link resolveBudgetAuth}, and returns
 * the first candidate the registry can authenticate.
 *
 * @param ctx - pi extension context
 *
 * @param options - optional budget-model configuration
 *
 * @param excludedModelSlugs - models whose completed attempts must not be selected again
 *
 * @throws {@link NoBudgetModelError} if no suitable model is found
 *
 * @returns budget model with auth credentials
 *
 * @mutates ctx - registry selection can invoke model accessors and command-backed auth capabilities
 *
 * @mutates options - override and strategy reads can invoke caller-owned accessors or proxy traps
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
    options,
    excludedModelSlugs = [],
  }: {
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly options?: BudgetModelOptions;
    readonly excludedModelSlugs?: readonly string[];
  },
): Promise<BudgetModel> {
  /**
   * Options with defaults applied so strategy branches read fields unconditionally.
   */
  const opts: BudgetModelOptions = options ?? { ...JUDGE_MODEL_DEFAULTS, };
  /**
   * Canonical slugs excluded after earlier judge attempts exhausted their retries.
   */
  const excludedSlugs = new Set(excludedModelSlugs,);

  if (opts.modelOverride
    !== undefined) {
    /**
     * Canonical-looking configured override slug used to skip a failed pinned
     * model without resolving its auth again.
     */
    const configuredOverrideSlug = (typeof opts.modelOverride) === 'string'
      ? opts.modelOverride
      : opts.modelOverride
        .model;
    if (!excludedSlugs.has(configuredOverrideSlug,)) {
      /**
       * Configured override remains first choice, but an override that already
       * failed gives way to automatic selection for fallback.
       */
      const overrideModel = await resolveBudgetModelOverride({
        override: opts.modelOverride,
        findModel(
          {
            provider,
            modelId,
          },
        ) {
          return findBudgetOverrideModel({
            ctx,
            provider,
            modelId,
          },);
        },
        /**
         * Resolves auth for configured override model.
         *
         * @param model - Registry model selected by override resolver.
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
      },);
      if (!excludedSlugs.has(budgetModelSlug(overrideModel.model,),))
        return overrideModel;
    }
  }

  if ((ctx.model
    === undefined) || (ctx.model
      === null))
    throw new NoBudgetModelError('no active model set',);

  /**
   * Active model handed in by host so same-provider selection has a reference provider.
   */
  const rawActiveModel: unknown = ctx.model;
  assertModelApi(rawActiveModel,);
  /**
   * Active model after runtime shape validation.
   */
  const activeModel = rawActiveModel;
  /**
   * Registry models narrowed to auto-mode's pi model shape for shared selection callbacks.
   */
  const rawAllModels: unknown = ctx.modelRegistry
    .getAll();
  assertModelApiList(rawAllModels,);
  /**
   * Registry models after runtime shape validation, excluding models whose
   * completed judge attempts already failed.
   */
  const allModels = rawAllModels.filter(
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
    strategy: opts.strategy,
    majorVersions: opts.majorVersions,
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
     * Checks auth configuration for one candidate model.
     *
     * @param model - Registry model inspected by auth storage.
     *
     * @returns Whether auth is configured.
     *
     * @mutates model - `hasConfiguredBudgetAuth` reads can invoke caller-owned model hooks.
     */
    hasConfiguredAuth({ model, }: { readonly model: ForeignBorrowed<Model<Api>>; },) {
      return hasConfiguredBudgetAuth({
        ctx,
        model,
      },);
    },
  },);
}

//endregion Public API

export { NoBudgetModelError, } from '@monochromatic-dev/pi-shared-model-selection/ts';
export { findBudgetModel, };
