/**
 * Budget model: auto-select the cheapest available judge model.
 *
 * Two strategies:
 * - `"same-provider"` (default): cheapest in the active provider
 * - `"any-provider"`: cheapest across ALL providers with an API key
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  findCheapestCandidate,
  type ModelCandidate,
  NoBudgetModelError,
  resolveAuth,
  toCandidate,
} from './budget-model-auth.ts';
import { findCheapestInMajorVersions, } from './budget-model-version.ts';
import { JUDGE_MODEL_DEFAULTS, } from './constants.ts';
import type {
  BudgetModel,
  BudgetModelAuth,
  BudgetModelOptions,
  ModelOverride,
} from './types.ts';

//region Public API

/**
 * Find the cheapest available model for the judge.
 *
 * If `options.modelOverride` is set, selection is skipped.
 * Otherwise the configured `strategy` walks candidate models
 * cheapest-first, gated by `costRatio` against the active model,
 * and returns the first candidate the registry can authenticate.
 *
 * @param ctx - extension context
 *
 * @param options - strategy, cost ratio, major version depth, and optional override
 *
 * @throws NoBudgetModelError if no suitable model is found
 *
 * @returns a budget model with auth credentials
 *
 * @example
 * ```typescript
 * const budget = await findBudgetModel(ctx);
 * ```
 */
async function findBudgetModel(
  ctx: ExtensionContext,
  options?: BudgetModelOptions,
): Promise<BudgetModel> {
  const opts: BudgetModelOptions = options ?? { ...JUDGE_MODEL_DEFAULTS, };

  if (opts.modelOverride !== undefined) {
    return await resolveModelOverride(
      ctx,
      opts.modelOverride,
    );
  }

  if (ctx.model === undefined || ctx.model === null)
    throw new NoBudgetModelError('no active model set',);

  /* `ctx.model` is `Model<any>` from pi-coding-agent; the helpers below only
     read `.provider` and `.cost.input`, both of which are present on every
     Model<TApi extends Api>. No cast or coercion needed. */
  const activeModel = ctx.model;

  if (opts.strategy === 'any-provider') {
    return await findAnyProvider(
      ctx,
      activeModel,
      opts.costRatio,
      opts.majorVersions,
    );
  }
  return await findSameProvider(
    ctx,
    activeModel,
    opts.costRatio,
    opts.majorVersions,
  );
}

//endregion

//region Same-provider strategy

/**
 * Find the cheapest model in the same provider as the active model.
 *
 * @param ctx - extension context
 *
 * @param activeModel - the currently active model
 *
 * @param costRatio - maximum cost ratio vs active model
 *
 * @param majorVersions - how many major version families to search
 *
 * @returns a budget model with auth credentials
 */
async function findSameProvider(
  ctx: ExtensionContext,
  /* `Model<any>` matches pi-coding-agent's ctx.model type; the helpers
     only read `.provider` and `.cost.input`, both of which are present
     on every Model<TApi extends Api>. */
  // oxlint-disable-next-line typescript-eslint(no-explicit-any) -- propagating pi-coding-agent's Model<any> typing
  activeModel: Model<any>,
  costRatio: number,
  majorVersions: number,
): Promise<BudgetModel> {
  const activeProvider = String(activeModel.provider,);
  const allModels = ctx.modelRegistry.getAll();
  const providerModels = allModels.filter(
    function sameProvider(m,) {
      return String(m.provider,) === activeProvider;
    },
  );

  /** Lazily find the cheapest candidate across all providers.
   *
   * @returns the cheapest model candidate found, or `null`
   */
  function lazyCheapestOverall(): Promise<ModelCandidate | null> {
    return findCheapestCandidate(
      ctx,
      allModels,
      majorVersions,
    );
  }

  if (providerModels.length === 0) {
    throw new NoBudgetModelError(
      `no models found for provider "${activeProvider}"`,
      { cheapestOverall: await lazyCheapestOverall(), },
    );
  }

  const candidates = findCheapestInMajorVersions(
    providerModels,
    majorVersions,
  );

  if (candidates.length === 0) {
    throw new NoBudgetModelError(
      `no versioned models found for provider "${activeProvider}"`,
      { cheapestOverall: await lazyCheapestOverall(), },
    );
  }

  // oxlint-disable-next-line prefer-destructuring -- destructuring changes type to T | undefined
  const cheapestCandidate = candidates[0];
  if (cheapestCandidate === undefined) {
    throw new NoBudgetModelError(
      `no candidates available for provider "${activeProvider}"`,
    );
  }

  if (cheapestCandidate.cost.input >= activeModel.cost.input * costRatio) {
    const sameProvider = toCandidate(
      ctx,
      cheapestCandidate,
      activeProvider,
    );
    throw new NoBudgetModelError(
      `cheapest model in ${activeProvider} is $${cheapestCandidate.cost.input}/M input; not significantly cheaper than active model ($${activeModel.cost.input}/M input)`,
      {
        sameProvider,
        cheapestOverall: await lazyCheapestOverall(),
      },
    );
  }

  for (const candidate of candidates) {
    if (candidate.cost.input >= activeModel.cost.input * costRatio)
      break;
    // oxlint-disable-next-line no-await-in-loop -- sequential: stop at first successful auth
    const auth = await resolveAuth(
      ctx,
      candidate,
    );
    if (auth !== null) {
      return {
        model: candidate,
        auth,
      };
    }
  }

  const sameProvider = toCandidate(
    ctx,
    cheapestCandidate,
    activeProvider,
  );
  throw new NoBudgetModelError(
    `no API key available for cheapest models in provider "${activeProvider}"`,
    {
      sameProvider,
      cheapestOverall: await lazyCheapestOverall(),
    },
  );
}

//endregion

//region Any-provider strategy

/**
 * Find the cheapest model across all providers.
 *
 * @param ctx - extension context
 *
 * @param activeModel - the currently active model
 *
 * @param costRatio - maximum cost ratio vs active model
 *
 * @param majorVersions - how many major version families to search
 *
 * @returns a budget model with auth credentials
 */
async function findAnyProvider(
  ctx: ExtensionContext,
  /* `Model<any>` matches pi-coding-agent's ctx.model type; the helpers
     only read `.provider` and `.cost.input`, both of which are present
     on every Model<TApi extends Api>. */
  // oxlint-disable-next-line typescript-eslint(no-explicit-any) -- propagating pi-coding-agent's Model<any> typing
  activeModel: Model<any>,
  costRatio: number,
  majorVersions: number,
): Promise<BudgetModel> {
  const allModels = ctx.modelRegistry.getAll();

  const byProvider = new Map<string, Model<Api>[]>();
  for (const m of allModels) {
    const p = String(m.provider,);
    if (!byProvider.has(p,)) {
      byProvider.set(
        p,
        [],
      );
    }
    const list = byProvider.get(p,);
    if (list !== undefined)
      list.push(m,);
  }

  const allCandidates: Model<Api>[] = [];
  for (const [, models,] of byProvider) {
    allCandidates.push(...findCheapestInMajorVersions(
      models,
      majorVersions,
    ),);
  }
  const sortedCandidates = allCandidates.toSorted(
    function byCost(
      a,
      b,
    ) {
      return a.cost.input - b.cost.input;
    },
  );

  // oxlint-disable-next-line prefer-destructuring -- destructuring changes type to T | undefined
  const cheapestCandidate = sortedCandidates[0];
  const cheapestCost = cheapestCandidate !== undefined
    ? cheapestCandidate.cost.input
    : Number.POSITIVE_INFINITY;

  if (cheapestCost >= activeModel.cost.input * costRatio) {
    throw new NoBudgetModelError(
      `cheapest model across all providers is $${cheapestCost}/M input; not significantly cheaper than active model ($${activeModel.cost.input}/M input)`,
    );
  }

  for (const model of sortedCandidates) {
    if (model.cost.input >= activeModel.cost.input * costRatio)
      break;
    // oxlint-disable-next-line no-await-in-loop -- sequential: stop at first successful auth
    const auth = await resolveAuth(
      ctx,
      model,
    );
    if (auth !== null) {
      return {
        model,
        auth,
      };
    }
  }

  throw new NoBudgetModelError(
    'no budget models with API keys found across any provider',
  );
}

//endregion

//region Model override

/**
 * Resolve a model override: skip auto-selection entirely.
 *
 * @param ctx - extension context
 *
 * @param override - the override specification
 *
 * @returns a budget model with auth credentials
 */
async function resolveModelOverride(
  ctx: ExtensionContext,
  override: ModelOverride,
): Promise<BudgetModel> {
  const modelId = typeof override === 'string' ? override : override.model;
  const slashIndex = modelId.indexOf('/',);
  const provider = modelId.slice(
    0,
    slashIndex,
  );
  const id = modelId.slice(slashIndex + 1,);

  // oxlint-disable-next-line unicorn/no-array-method-this-argument -- ModelRegistry.find is not Array.find
  const model = ctx.modelRegistry.find(
    // oxlint-disable-next-line unicorn/no-array-method-this-argument -- second arg
    provider,
    id,
  );
  if (model === undefined || model === null) {
    throw new NoBudgetModelError(
      `model override "${modelId}" not found in registry`,
    );
  }

  if (typeof override !== 'string') {
    const { auth, } = override;
    const typedAuth: BudgetModelAuth = auth;
    return {
      model,
      auth: typedAuth,
    };
  }

  const auth = await resolveAuth(
    ctx,
    model,
  );
  if (auth === null) {
    throw new NoBudgetModelError(
      `no API key for model override "${modelId}"`,
    );
  }

  return {
    model,
    auth,
  };
}

//endregion

export {
  findBudgetModel,
  NoBudgetModelError,
};
