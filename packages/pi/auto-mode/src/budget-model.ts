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
 * @throws NoBudgetModelError if no suitable model is found
 *
 * @returns a budget model with auth credentials
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
    ctx: ExtensionContext;
    options?: BudgetModelOptions;
  },
): Promise<BudgetModel> {
  /** Options with defaults applied so the strategy branches below can read fields unconditionally. */
  const opts: BudgetModelOptions = options ?? { ...JUDGE_MODEL_DEFAULTS, };

  if (opts.modelOverride !== undefined) {
    return await resolveModelOverride({
      ctx,
      override: opts.modelOverride,
    },);
  }

  if ((ctx.model === undefined) || (ctx.model === null))
    throw new NoBudgetModelError('no active model set',);

  /**
   * Active model handed in by the host so the cost-ratio gate has a reference point.
   *
   * `ctx.model` is `Model<any>` from pi-coding-agent; the helpers below only
   * read `.provider` and `.cost.input`, both of which are present on every
   * `Model<TApi extends Api>`. No cast or coercion needed.
   */
  const activeModel = ctx.model;

  if (opts.strategy === 'any-provider') {
    return await findAnyProvider({
      ctx,
      activeModel,
      costRatio: opts.costRatio,
      majorVersions: opts.majorVersions,
    },);
  }
  return await findSameProvider({
    ctx,
    activeModel,
    costRatio: opts.costRatio,
    majorVersions: opts.majorVersions,
  },);
}

//endregion

//region Same-provider strategy

/**
 * Find the cheapest model in the same provider as the active model.
 *
 * @returns a budget model with auth credentials
 */
async function findSameProvider(
  {
    ctx,
    activeModel,
    costRatio,
    majorVersions,
  }: {
    ctx: ExtensionContext;
    /* `Model<any>` matches pi-coding-agent's ctx.model type; the helpers
       only read `.provider` and `.cost.input`, both of which are present
       on every Model<TApi extends Api>. */
    // oxlint-disable-next-line typescript-eslint/no-explicit-any -- propagating pi-coding-agent's Model<any> typing
    activeModel: Model<any>;
    costRatio: number;
    majorVersions: number;
  },
): Promise<BudgetModel> {
  /** Active provider name normalised to string; used to filter the registry. */
  const activeProvider = String(activeModel.provider,);
  /** Every model the registry knows about; filtered to same-provider candidates below. */
  const allModels = ctx.modelRegistry.getAll();
  /** Subset of `allModels` sharing the active provider. */
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
    return findCheapestCandidate({
      ctx,
      allModels,
      majorVersions,
    },);
  }

  if (providerModels.length === 0) {
    throw new NoBudgetModelError(
      `no models found for provider "${activeProvider}"`,
      { cheapestOverall: await lazyCheapestOverall(), },
    );
  }

  /** Same-provider candidates ranked by cost then version, the search frontier for this strategy. */
  const candidates = findCheapestInMajorVersions({
    models: providerModels,
    majorVersions,
  },);

  if (candidates.length === 0) {
    throw new NoBudgetModelError(
      `no versioned models found for provider "${activeProvider}"`,
      { cheapestOverall: await lazyCheapestOverall(), },
    );
  }

  /* oxlint-disable prefer-destructuring -- destructuring changes type to T | undefined */
  /** Cheapest same-provider candidate; head of `candidates`, kept as `T` (not `T | undefined`). */
  const cheapestCandidate = candidates[0];
  /* oxlint-enable prefer-destructuring */
  if (cheapestCandidate === undefined) {
    throw new NoBudgetModelError(
      `no candidates available for provider "${activeProvider}"`,
    );
  }

  if (cheapestCandidate.cost.input >= (activeModel.cost.input * costRatio)) {
    /** Same-provider report row for the error message; the cheapest model is too expensive to use. */
    const sameProvider = toCandidate({
      ctx,
      model: cheapestCandidate,
      provider: activeProvider,
    },);
    throw new NoBudgetModelError(
      `cheapest model in ${activeProvider} is $${cheapestCandidate.cost.input}/M input; not significantly cheaper than active model ($${activeModel.cost.input}/M input)`,
      {
        sameProvider,
        cheapestOverall: await lazyCheapestOverall(),
      },
    );
  }

  for (const candidate of candidates) {
    if (candidate.cost.input >= (activeModel.cost.input * costRatio))
      break;
    /* oxlint-disable no-await-in-loop -- sequential: stop at first successful auth */
    /** Resolved auth for the current candidate; `null` falls through to the next iteration. */
    const auth = await resolveAuth({
      ctx,
      model: candidate,
    },);
    /* oxlint-enable no-await-in-loop */
    if (auth !== null) {
      return {
        model: candidate,
        auth,
      };
    }
  }

  /** Same-provider report row for the error message; every same-provider candidate failed auth. */
  const sameProvider = toCandidate({
    ctx,
    model: cheapestCandidate,
    provider: activeProvider,
  },);
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
 * @returns a budget model with auth credentials
 */
async function findAnyProvider(
  {
    ctx,
    activeModel,
    costRatio,
    majorVersions,
  }: {
    ctx: ExtensionContext;
    /* `Model<any>` matches pi-coding-agent's ctx.model type; the helpers
       only read `.provider` and `.cost.input`, both of which are present
       on every Model<TApi extends Api>. */
    // oxlint-disable-next-line typescript-eslint/no-explicit-any -- propagating pi-coding-agent's Model<any> typing
    activeModel: Model<any>;
    costRatio: number;
    majorVersions: number;
  },
): Promise<BudgetModel> {
  /** Every model the registry knows about, regardless of provider. */
  const allModels = ctx.modelRegistry.getAll();

  /** Provider name to its list of models so version ranking runs per provider. */
  const byProvider = new Map<string, Model<Api>[]>();
  for (const m of allModels) {
    /** Provider name normalised to string; the type allows non-string discriminants from upstream. */
    const p = String(m.provider,);
    if (!byProvider.has(p,)) {
      byProvider.set(
        p,
        [],
      );
    }
    /** Bucket the current model goes into; defined after the `set` above. */
    const list = byProvider.get(p,);
    if (list !== undefined)
      list.push(m,);
  }

  /** Flat union of every provider's top candidates; resorted by cost below. */
  const allCandidates: Model<Api>[] = [];
  for (const [, models,] of byProvider) {
    allCandidates.push(...findCheapestInMajorVersions({
      models,
      majorVersions,
    },),);
  }
  /** Cross-provider candidates sorted by input cost ascending; the loop walks this in order. */
  const sortedCandidates = allCandidates.toSorted(
    function byCost(
      a,
      b,
    ) {
      return a.cost.input - b.cost.input;
    },
  );

  /* oxlint-disable prefer-destructuring -- destructuring changes type to T | undefined */
  /** Head of the sorted list; `T | undefined` becomes `T` after the `!== undefined` check below. */
  const cheapestCandidate = sortedCandidates[0];
  /* oxlint-enable prefer-destructuring */
  /** Input cost of the cheapest candidate, or `Infinity` so the empty case fails the ratio gate. */
  const cheapestCost = cheapestCandidate !== undefined
    ? cheapestCandidate.cost.input
    : Number.POSITIVE_INFINITY;

  if (cheapestCost >= (activeModel.cost.input * costRatio)) {
    throw new NoBudgetModelError(
      `cheapest model across all providers is $${cheapestCost}/M input; not significantly cheaper than active model ($${activeModel.cost.input}/M input)`,
    );
  }

  for (const model of sortedCandidates) {
    if (model.cost.input >= (activeModel.cost.input * costRatio))
      break;
    /* oxlint-disable no-await-in-loop -- sequential: stop at first successful auth */
    /** Resolved auth for the current candidate; `null` falls through to the next iteration. */
    const auth = await resolveAuth({
      ctx,
      model,
    },);
    /* oxlint-enable no-await-in-loop */
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
 * @returns a budget model with auth credentials
 */
async function resolveModelOverride(
  {
    ctx,
    override,
  }: {
    ctx: ExtensionContext;
    override: ModelOverride;
  },
): Promise<BudgetModel> {
  /** `provider/id` string form of the override, regardless of whether it came as a bare string or struct. */
  const modelId = (typeof override) === 'string' ? override : override.model;
  /** Index of the `/` separator between provider and model id; `-1` is acceptable, slice clamps. */
  const slashIndex = modelId.indexOf('/',);
  /** Substring before the `/`, e.g. `openai` in `openai/gpt-4o-mini`. */
  const provider = modelId.slice(
    0,
    slashIndex,
  );
  /** Substring after the `/`, e.g. `gpt-4o-mini`. */
  const id = modelId.slice(slashIndex + 1,);

  /* oxlint-disable unicorn/no-array-method-this-argument -- ModelRegistry.find is not Array.find */
  /** Registry-resolved model record, or `null`/`undefined` when the override does not exist. */
  const model = ctx.modelRegistry.find(
    provider,
    id,
  );
  /* oxlint-enable unicorn/no-array-method-this-argument */
  if ((model === undefined) || (model === null)) {
    throw new NoBudgetModelError(
      `model override "${modelId}" not found in registry`,
    );
  }

  if ((typeof override) !== 'string') {
    /** Inline auth from the override struct; bypasses the registry. */
    const { auth, } = override;
    /** Widened auth to satisfy the BudgetModelAuth alias on the return type. */
    const typedAuth: BudgetModelAuth = auth;
    return {
      model,
      auth: typedAuth,
    };
  }

  /** Registry-resolved auth for the override; throws below when the registry has no key. */
  const auth = await resolveAuth({
    ctx,
    model,
  },);
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
