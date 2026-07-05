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
  NoBudgetModelError,
  resolveBudgetModelOverride,
  selectBudgetModel,
} from '@monochromatic-dev/pi-shared-model-selection/ts';
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
 * @throws {@link NoBudgetModelError} if no suitable model is found
 *
 * @returns budget model with auth credentials
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
  }: {
    readonly ctx: ExtensionContext;
    readonly options?: BudgetModelOptions;
  },
): Promise<BudgetModel> {
  /**
   * Options with defaults applied so strategy branches read fields unconditionally.
   */
  const opts: BudgetModelOptions = options ?? { ...JUDGE_MODEL_DEFAULTS, };

  if (opts.modelOverride
    !== undefined) {
    return await resolveBudgetModelOverride({
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
      async resolveAuth({ model, },) {
        return await resolveBudgetAuth({
          ctx,
          model,
        },);
      },
    },);
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
   * Registry models after runtime shape validation.
   */
  const allModels = rawAllModels;

  return await selectBudgetModel<Model<Api>>({
    activeModel,
    allModels,
    strategy: opts.strategy,
    majorVersions: opts.majorVersions,
    async resolveAuth({ model, },) {
      return await resolveBudgetAuth({
        ctx,
        model,
      },);
    },
    hasConfiguredAuth({ model, },) {
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
