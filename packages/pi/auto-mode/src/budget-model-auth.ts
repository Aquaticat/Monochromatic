/**
 * Budget model auth resolution and the `NoBudgetModelError` reporting
 * type. Exports the candidate-finder helpers used by the same- and
 * any-provider strategies in `budget-model.ts`.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import { l as parentLogger, } from './log.ts';

/** Tagged logger for the budget-model-auth module. */
const l = tagged({
  tag: 'budget-model-auth',
  l: parentLogger,
},);

//region Candidate type

/** A model candidate found during search. */
type ModelCandidate = {
  readonly provider: string;
  readonly modelId: string;
  readonly costInput: number;
  readonly costOutput: number;
  readonly hasApiKey: boolean;
};

//endregion

//region Error class

/**
 * Error thrown when no suitable budget model can be found.
 *
 * Includes the best candidates from the active provider
 * and across all providers for custom fallback logic.
 */
class NoBudgetModelError extends Error {
  /** Why no budget model was found. */
  readonly reason: string;
  /** Best candidate from the same provider, when one was found. */
  readonly sameProvider?: ModelCandidate;
  /** Cheapest candidate across all providers, when one was found. */
  readonly cheapestOverall?: ModelCandidate;

  /**
   * Construct a NoBudgetModelError.
   *
   * @param reason - why no budget model was found
   *
   * @param candidates - optional context about candidates found
   */
  constructor(
    reason: string,
    candidates: {
      readonly sameProvider?: ModelCandidate;
      readonly cheapestOverall?: ModelCandidate;
    } = {},
  ) {
    /** Per-line accumulator for the multi-line error message; joined with newlines below. */
    const lines = [
      "Tried to auto-detect a budget model for a background task, but couldn't find one.",
      `Reason: ${reason}`,
    ];
    if (candidates.sameProvider
      !== undefined) {
      /** Local alias for the same-provider candidate so the template strings stay readable. */
      const c = candidates.sameProvider;
      lines.push(
        `Best same-provider option: ${c.provider}/${c.modelId} ($${c.costInput}/$${c.costOutput} per M tokens)`,
      );
    }
    /** Cheapest-overall candidate, surfaced only when present and carrying an API key. */
    const cheapest = candidates.cheapestOverall;
    if (cheapest?.hasApiKey
      === true) {
      lines.push(
        `Cheapest with API key: ${cheapest.provider}/${cheapest.modelId} ($${cheapest.costInput}/$${cheapest.costOutput} per M tokens)`,
      );
    }
    lines.push(
      'To fix: configure a model explicitly in the extension settings, or switch to a provider with cheaper models.',
    );

    super(lines.join('\n',),);
    this.name = 'NoBudgetModelError';
    this.reason = reason;
    if (candidates.sameProvider
      !== undefined)
      this.sameProvider = candidates.sameProvider;
    if (candidates.cheapestOverall
      !== undefined)
      this.cheapestOverall = candidates.cheapestOverall;
  }
}

//endregion

//region Shared internals

/**
 * Build a ModelCandidate from a Model.
 *
 * @returns a ModelCandidate
 *
 * @example
 * ```typescript
 * const candidate = toCandidate({ ctx, model, provider: "openai" });
 * ```
 */
function toCandidate(
  {
    ctx,
    model,
    provider,
  }: {
    readonly ctx: ExtensionContext;
    readonly model: Model<Api>;
    readonly provider: string;
  },
): ModelCandidate {
  return {
    provider,
    modelId: model.id,
    costInput: model.cost
      .input,
    costOutput: model.cost
      .output,
    hasApiKey: ctx.modelRegistry
      .hasConfiguredAuth(model,),
  };
}

/**
 * Resolve auth for a model via the registry.
 *
 * Uses `getApiKeyAndHeaders` instead of upstream's broken `getApiKey`.
 *
 * @returns `{ found: true, auth }` with credentials, or `{ found: false }`
 *   when resolution failed
 *
 * @example
 * ```typescript
 * const auth = await resolveAuth({ ctx, model });
 * ```
 */
async function resolveAuth(
  {
    ctx,
    model,
  }: {
    readonly ctx: ExtensionContext;
    readonly model: Model<Api>;
  },
): Promise<
  | {
    found: true;
    auth: {
      apiKey?: string;
      headers?: Record<string, string>;
    };
  }
  | { found: false }
> {
  try {
    /** Registry response carrying `ok` plus optional `apiKey` and `headers`. */
    const result = await ctx.modelRegistry
      .getApiKeyAndHeaders(model,);
    if (!result.ok)
      return { found: false, };
    /** Output auth object assembled field-by-field so omitted keys stay undefined rather than `null`. */
    const auth: {
      apiKey?: string;
      headers?: Record<string, string>;
    } = {};
    if (result.apiKey
      !== undefined)
      auth.apiKey = result.apiKey;
    if (result.headers
      !== undefined)
      auth.headers = result.headers;
    return {
      found: true,
      auth,
    };
  }
  catch (err) {
    /** Per-call sub-logger so log lines from this entry point carry the function name as a tag. */
    const innerL = tagged({
      tag: resolveAuth.name,
      l,
    },);
    innerL.error(
      `getApiKeyAndHeaders failed for ${model.provider}/${model.id}: ${
        err instanceof Error ? err.message : String(err,)
      }`,
    );
    return { found: false, };
  }
}

/**
 * Find the single cheapest model across all providers (for error context).
 *
 * @returns `{ found: true, candidate }` for the cheapest candidate, or
 *   `{ found: false }` when no provider yielded one
 *
 * @example
 * ```typescript
 * const cheapest = await findCheapestCandidate({ ctx, allModels: models, majorVersions: 1 });
 * ```
 */
async function findCheapestCandidate(
  {
    ctx,
    allModels,
    majorVersions,
  }: {
    readonly ctx: ExtensionContext;
    readonly allModels: readonly Model<Api>[];
    readonly majorVersions: number;
  },
): Promise<
  | {
    found: true;
    candidate: ModelCandidate;
  }
  | { found: false }
> {
  /** Dynamically imported version helper; lazy to break a potential circular import on module init. */
  const { findCheapestInMajorVersions, } = await import('./budget-model-version.ts');
  /** Provider name to its list of models, used so version ranking runs per provider. */
  const byProvider = new Map<string, Model<Api>[]>();
  for (const m of allModels) {
    /** Provider name keying the grouping map. */
    const p = m.provider;
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

  /** Cheapest per-provider head for every provider that yielded a candidate. */
  const providerHeads: {
    model: Model<Api>;
    provider: string;
  }[] = [];
  for (const [provider, models,] of byProvider) {
    /** Per-provider candidates already sorted by cost then version. */
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

  /** Overall cheapest provider-head by input cost; `undefined` when no provider yielded a candidate. */
  const best = providerHeads.toSorted(
    function byInputCost(
      a,
      b,
    ) {
      return a.model
        .cost
        .input
        - b
        .model
        .cost
        .input;
    },
  )
    .at(0,);

  if (best === undefined)
    return { found: false, };
  return {
    found: true,
    candidate: toCandidate({
      ctx,
      model: best.model,
      provider: best.provider,
    },),
  };
}

//endregion

export {
  findCheapestCandidate,
  NoBudgetModelError,
  resolveAuth,
  toCandidate,
};
export type { ModelCandidate, };
