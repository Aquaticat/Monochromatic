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
  provider: string;
  modelId: string;
  costInput: number;
  costOutput: number;
  hasApiKey: boolean;
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
  /** Best candidate from the same provider. */
  readonly sameProvider: ModelCandidate | null;
  /** Cheapest candidate across all providers. */
  readonly cheapestOverall: ModelCandidate | null;

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
      sameProvider?: ModelCandidate | null;
      cheapestOverall?: ModelCandidate | null;
    } = {},
  ) {
    /** Per-line accumulator for the multi-line error message; joined with newlines below. */
    const lines = [
      "Tried to auto-detect a budget model for a background task, but couldn't find one.",
      `Reason: ${reason}`,
    ];
    if ((candidates.sameProvider
      !== undefined) && (candidates.sameProvider
      !== null)) {
      /** Local alias for the same-provider candidate so the template strings stay readable. */
      const c = candidates.sameProvider;
      lines.push(
        `Best same-provider option: ${c.provider}/${c.modelId} ($${c.costInput}/$${c.costOutput} per M tokens)`,
      );
    }
    if (
      (candidates.cheapestOverall !== undefined)
      && (candidates.cheapestOverall !== null)
        && candidates
        .cheapestOverall
        .hasApiKey
    ) {
      /** Local alias for the cheapest-overall candidate so the template strings stay readable. */
      const c = candidates.cheapestOverall;
      lines.push(
        `Cheapest with API key: ${c.provider}/${c.modelId} ($${c.costInput}/$${c.costOutput} per M tokens)`,
      );
    }
    lines.push(
      'To fix: configure a model explicitly in the extension settings, or switch to a provider with cheaper models.',
    );

    super(lines.join('\n',),);
    this.name = 'NoBudgetModelError';
    this.reason = reason;
    this.sameProvider = candidates.sameProvider
      ?? null;
    this.cheapestOverall = candidates.cheapestOverall
      ?? null;
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
    ctx: ExtensionContext;
    model: Model<Api>;
    provider: string;
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
 * @returns auth credentials, or `null` if resolution failed
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
    ctx: ExtensionContext;
    model: Model<Api>;
  },
): Promise<{
  apiKey?: string;
  headers?: Record<string, string>;
} | null> {
  try {
    /** Registry response carrying `ok` plus optional `apiKey` and `headers`. */
    const result = await ctx.modelRegistry
      .getApiKeyAndHeaders(model,);
    if (!result.ok)
      return null;
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
    return auth;
  }
  catch (err) {
    /** Per-call sub-logger so log lines from this entry point carry the function name as a tag. */
    const innerL = tagged({
      tag: resolveAuth.name,
      l,
    },);
    innerL.error(
      `getApiKeyAndHeaders failed for ${String(model.provider,)}/${model.id}: ${
        err instanceof Error ? err.message : String(err,)
      }`,
    );
    return null;
  }
}

/**
 * Find the single cheapest model across all providers (for error context).
 *
 * @returns the cheapest candidate, or `null` if none found
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
    ctx: ExtensionContext;
    allModels: Model<Api>[];
    majorVersions: number;
  },
): Promise<ModelCandidate | null> {
  /** Dynamically imported version helper; lazy to break a potential circular import on module init. */
  const { findCheapestInMajorVersions, } = await import('./budget-model-version.ts');
  /** Provider name to its list of models, used so version ranking runs per provider. */
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

  /** Best (cheapest-input) candidate across all providers; `null` when no provider yielded a candidate. */
  const best = [...byProvider,].reduce<
    | {
      model: Model<Api>;
      provider: string;
    }
    | null
  >(
    function pickBest(
      acc,
      [provider, models,],
    ) {
      /** Per-provider candidates already sorted by cost then version. */
      const candidates = findCheapestInMajorVersions({
        models,
        majorVersions,
      },);
      /** Head of the per-provider candidate list; compared against `acc` to find the overall cheapest. */
      const [firstCandidate,] = candidates;
      if (firstCandidate === undefined)
        return acc;
      if ((acc === null) || (firstCandidate.cost
        .input
        < acc
        .model
        .cost
        .input)) {
        return {
          model: firstCandidate,
          provider,
        };
      }
      return acc;
    },
    null,
  );

  if (best === null)
    return null;
  return toCandidate({
    ctx,
    model: best.model,
    provider: best.provider,
  },);
}

//endregion

export {
  findCheapestCandidate,
  NoBudgetModelError,
  resolveAuth,
  toCandidate,
};
export type { ModelCandidate, };
