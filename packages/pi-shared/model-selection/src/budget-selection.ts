/**
 * Budget-model strategy selection with injected auth callbacks.
 *
 * @module
 */

import {
  budgetModelSlug,
  NoBudgetModelError,
  toBudgetModelCandidate,
} from './budget-report.ts';
import { findCheapestInMajorVersions, } from './version.ts';
import {
  type BudgetModel,
  type BudgetModelCandidate,
  type BudgetModelSelectionOptions,
  type ModelPricing,
  NO_AUTH,
} from './types.ts';

/**
 * Sentinel returned by {@link findCheapestCandidate} when no provider yields a
 * candidate (empty registry). A `unique symbol`; narrowed with
 * `=== NO_CANDIDATE`. Exported because `findCheapestCandidate` is public.
 */
export const NO_CANDIDATE: unique symbol = Symbol('model-selection/no-candidate',);

//region Internal types

/**
 * Options shared by concrete budget-model strategy helpers.
 */
type BudgetStrategyOptions<TModel extends ModelPricing,> = Omit<
  BudgetModelSelectionOptions<TModel>,
  'strategy'
>;

//endregion Internal types

//region Public API

/**
 * Find the cheapest authenticated budget model for configured strategy.
 *
 * @param options - active model, model list, strategy, major versions, and auth callbacks
 *
 * @returns selected budget model with auth
 *
 * @throws NoBudgetModelError when no suitable model is found
 *
 * @example
 * ```typescript
 * const budget = await selectBudgetModel({ activeModel, allModels, strategy, majorVersions, resolveAuth, hasConfiguredAuth });
 * ```
 */
export async function selectBudgetModel<TModel extends ModelPricing,>(
  options: BudgetModelSelectionOptions<TModel>,
): Promise<BudgetModel<TModel>> {
  if (options.strategy
    === 'any-provider') {
    return await findAnyProvider({
      activeModel: options.activeModel,
      allModels: options.allModels,
      majorVersions: options.majorVersions,
      resolveAuth: options.resolveAuth,
      hasConfiguredAuth: options.hasConfiguredAuth,
    },);
  }
  return await findSameProvider({
    activeModel: options.activeModel,
    allModels: options.allModels,
    majorVersions: options.majorVersions,
    resolveAuth: options.resolveAuth,
    hasConfiguredAuth: options.hasConfiguredAuth,
  },);
}

/**
 * Find the single cheapest model across all providers for error context.
 *
 * @param allModels - registry model list
 *
 * @param majorVersions - major-version families to search
 *
 * @param hasConfiguredAuth - host auth predicate for reporting
 *
 * @returns cheapest candidate when present
 *
 * @example
 * ```typescript
 * const candidate = findCheapestCandidate({ allModels, majorVersions, hasConfiguredAuth });
 * ```
 */
export function findCheapestCandidate<TModel extends ModelPricing,>(
  {
    allModels,
    majorVersions,
    hasConfiguredAuth,
  }: {
    readonly allModels: readonly TModel[];
    readonly majorVersions: number;
    readonly hasConfiguredAuth: (options: { readonly model: TModel; }) => boolean;
  },
): BudgetModelCandidate | typeof NO_CANDIDATE {
  /**
   * Provider name to its list of models.
   */
  const byProvider = groupModelsByProvider(allModels,);

  /**
   * Cheapest per-provider head for every provider that yielded a candidate.
   */
  const providerHeads: {
    readonly model: TModel;
    readonly provider: string;
  }[] = [];
  for (const [provider, models,] of byProvider) {
    /**
     * Per-provider candidates already sorted by cost then version.
     */
    const firstCandidate = findCheapestInMajorVersions({
      models,
      majorVersions,
    },)
      .at(0,);
    if (firstCandidate !== undefined) {
      providerHeads.push({
        model: firstCandidate,
        provider,
      },);
    }
  }

  /**
   * Overall cheapest provider head by input cost.
   */
  const best = providerHeads.toSorted(function byInputCost(
    left,
    right,
  ) {
    /**
     * Models being compared.
     */
    const { model: leftModel, } = left;
    /**
     * Model being compared against.
     */
    const { model: rightModel, } = right;
    /**
     * Left candidate input price.
     */
    const { input: leftInputCost, } = leftModel.cost;
    /**
     * Right candidate input price.
     */
    const { input: rightInputCost, } = rightModel.cost;
    return leftInputCost - rightInputCost;
  },)
    .at(0,);

  if (best === undefined)
    return NO_CANDIDATE;
  return toBudgetModelCandidate({
    model: best.model,
    hasConfiguredAuth: hasConfiguredAuth({ model: best.model, },),
  },);
}

//endregion Public API

//region Same-provider strategy

/**
 * Find cheapest model in the same provider as active model.
 *
 * @param activeModel - active model used for provider reference
 *
 * @param allModels - registry model list
 *
 * @param majorVersions - major-version families to search
 *
 * @param resolveAuth - host auth resolver
 *
 * @param hasConfiguredAuth - host auth predicate for reporting
 *
 * @returns selected budget model
 */
async function findSameProvider<TModel extends ModelPricing,>(
  {
    activeModel,
    allModels,
    majorVersions,
    resolveAuth,
    hasConfiguredAuth,
  }: BudgetStrategyOptions<TModel>,
): Promise<BudgetModel<TModel>> {
  /**
   * Active provider name used to filter registry.
   */
  const activeProvider = activeModel.provider;
  /**
   * Subset of all models sharing active provider.
   */
  const providerModels = allModels.filter(function sameProvider(model,) {
    return model.provider
      === activeProvider;
  },);

  /**
   * Lazily find cheapest candidate across all providers.
   *
   * @returns error-context object carrying cheapestOverall only when found
   */
  function cheapestOverallContext(): {
    readonly cheapestOverall?: BudgetModelCandidate;
  } {
    /**
     * Cheapest cross-provider candidate result.
     */
    const candidate = findCheapestCandidate({
      allModels,
      majorVersions,
      hasConfiguredAuth,
    },);
    return candidate === NO_CANDIDATE
      ? {}
      : { cheapestOverall: candidate, };
  }

  if (providerModels.length
    === 0) {
    throw new NoBudgetModelError(
      `no models found for provider "${activeProvider}"`,
      cheapestOverallContext(),
    );
  }

  /**
   * Same-provider candidates ranked by cost then version.
   */
  const candidates = findCheapestInMajorVersions({
    models: providerModels,
    majorVersions,
  },);

  if (candidates.length
    === 0) {
    throw new NoBudgetModelError(
      `no versioned models found for provider "${activeProvider}"`,
      cheapestOverallContext(),
    );
  }

  /**
   * Cheapest same-provider candidate.
   */
  const cheapestCandidate = candidates.at(0,);
  if (cheapestCandidate === undefined) {
    throw new NoBudgetModelError(
      `no candidates available for provider "${activeProvider}"`,
    );
  }

  for (const candidate of candidates) {
    /* oxlint-disable no-await-in-loop -- sequential auth walk must stop at first successful candidate. */
    /**
     * Resolved auth for current candidate.
     */
    const auth = await resolveAuth({ model: candidate, },);
    /* oxlint-enable no-await-in-loop */
    if (auth !== NO_AUTH) {
      return {
        model: candidate,
        auth,
      };
    }
  }

  /**
   * Same-provider report row after every candidate failed auth.
   */
  const sameProvider = toBudgetModelCandidate({
    model: cheapestCandidate,
    hasConfiguredAuth: hasConfiguredAuth({ model: cheapestCandidate, },),
  },);
  throw new NoBudgetModelError(
    `no API key available for cheapest models in provider "${activeProvider}"`,
    {
      sameProvider,
      ...cheapestOverallContext(),
    },
  );
}

//endregion Same-provider strategy

//region Any-provider strategy

/**
 * Find cheapest model across all providers.
 *
 * @param allModels - registry model list
 *
 * @param majorVersions - major-version families to search
 *
 * @param resolveAuth - host auth resolver
 *
 * @returns selected budget model
 */
async function findAnyProvider<TModel extends ModelPricing,>(
  {
    allModels,
    majorVersions,
    resolveAuth,
  }: BudgetStrategyOptions<TModel>,
): Promise<BudgetModel<TModel>> {
  /**
   * Provider name to its list of models.
   */
  const byProvider = groupModelsByProvider(allModels,);

  /**
   * Flat union of every provider's top candidates.
   */
  const allCandidates: TModel[] = [];
  for (const [, models,] of byProvider) {
    allCandidates.push(...findCheapestInMajorVersions({
      models,
      majorVersions,
    },),);
  }
  /**
   * Cross-provider candidates sorted by input cost ascending.
   */
  const sortedCandidates = allCandidates.toSorted(function byCost(
    left,
    right,
  ) {
    /**
     * Left candidate input price.
     */
    const { input: leftInputCost, } = left.cost;
    /**
     * Right candidate input price.
     */
    const { input: rightInputCost, } = right.cost;
    return leftInputCost - rightInputCost;
  },);

  for (const model of sortedCandidates) {
    /* oxlint-disable no-await-in-loop -- sequential auth walk must stop at first successful candidate. */
    /**
     * Resolved auth for current candidate.
     */
    const auth = await resolveAuth({ model, },);
    /* oxlint-enable no-await-in-loop */
    if (auth !== NO_AUTH) {
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

//endregion Any-provider strategy

//region Helpers

/**
 * Group models by provider.
 *
 * @param models - models to group
 *
 * @returns provider to model list map
 */
function groupModelsByProvider<TModel extends ModelPricing,>(
  models: readonly TModel[],
): Map<string, TModel[]> {
  /**
   * Provider name to models.
   */
  const byProvider = new Map<string, TModel[]>();
  for (const model of models) {
    /**
     * Provider name keying grouping map.
     */
    const { provider, } = model;
    if (!byProvider.has(provider,)) {
      byProvider.set(
        provider,
        [],
      );
    }
    /**
     * Bucket current model goes into.
     */
    const list = byProvider.get(provider,);
    if (list !== undefined)
      list.push(model,);
  }
  return byProvider;
}

export { budgetModelSlug, };

//endregion Helpers
