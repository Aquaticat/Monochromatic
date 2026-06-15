/**
 * Budget model: auto-select the cheapest available judge model.
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

//region Public API

/**
 * Find the cheapest available model for the judge.
 *
 * If `options.modelOverride` is set, selection is skipped. Otherwise shared
 * strategy selection walks candidate models cheapest-first and returns the
 * first candidate the registry can authenticate.
 *
 * @param ctx - pi extension context
 *
 * @param options - optional budget-model configuration
 *
 * @throws NoBudgetModelError if no suitable model is found
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
  const activeModel = ctx.model as Model<Api>;
  /**
   * Registry models narrowed to auto-mode's pi model shape for shared selection callbacks.
   */
  const allModels = ctx.modelRegistry
    .getAll() as readonly Model<Api>[];

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

export {
  findBudgetModel,
  NoBudgetModelError,
};
