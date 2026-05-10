/**
 * Budget model error class.
 *
 * Extracted from budget-model.ts to stay within the line limit.
 *
 * @module
 */

import type {
  Api,
  Model,
} from "@earendil-works/pi-ai";
import type { ExtensionContext, } from "@earendil-works/pi-coding-agent";

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
    const lines = [
      "Tried to auto-detect a budget model for a background task, but couldn't find one.",
      `Reason: ${reason}`,
    ];
    if (candidates.sameProvider !== undefined && candidates.sameProvider !== null) {
      const c = candidates.sameProvider;
      lines.push(
        `Best same-provider option: ${c.provider}/${c.modelId} ($${c.costInput}/$${c.costOutput} per M tokens)`,
      );
    }
    if (
      candidates.cheapestOverall !== undefined &&
      candidates.cheapestOverall !== null &&
      candidates.cheapestOverall.hasApiKey
    ) {
      const c = candidates.cheapestOverall;
      lines.push(
        `Cheapest with API key: ${c.provider}/${c.modelId} ($${c.costInput}/$${c.costOutput} per M tokens)`,
      );
    }
    lines.push(
      "To fix: configure a model explicitly in the extension settings, or switch to a provider with cheaper models.",
    );

    super(
      lines.join("\n"),
      { cause: undefined },
    );
    this.name = "NoBudgetModelError";
    this.reason = reason;
    this.sameProvider = candidates.sameProvider ?? null;
    this.cheapestOverall = candidates.cheapestOverall ?? null;
  }
}

//endregion

//region Shared internals

/**
 * Build a ModelCandidate from a Model.
 *
 * @param ctx - extension context
 *
 * @param model - the model
 *
 * @param provider - the provider name
 *
 * @returns a ModelCandidate
 *
 * @example
 * ```typescript
 * const candidate = toCandidate(ctx, model, "openai");
 * ```
 */
function toCandidate(
  ctx: ExtensionContext,
  model: Model<Api>,
  provider: string,
): ModelCandidate {
  return {
    provider,
    modelId: model.id,
    costInput: model.cost.input,
    costOutput: model.cost.output,
    hasApiKey: ctx.modelRegistry.hasConfiguredAuth(model),
  };
}

/**
 * Resolve auth for a model via the registry.
 *
 * Uses `getApiKeyAndHeaders` instead of upstream's broken `getApiKey`.
 *
 * @param ctx - extension context
 *
 * @param model - the model to resolve auth for
 *
 * @returns auth credentials, or `null` if resolution failed
 *
 * @example
 * ```typescript
 * const auth = await resolveAuth(ctx, model);
 * ```
 */
async function resolveAuth(
  ctx: ExtensionContext,
  model: Model<Api>,
): Promise<{
  apiKey?: string;
  headers?: Record<string, string>
} | null> {
  try {
    const result = await ctx.modelRegistry.getApiKeyAndHeaders(model);
    if (!result.ok) return null;
    const auth: {
      apiKey?: string;
      headers?: Record<string, string>
    } = {};
    if (result.apiKey !== undefined) auth.apiKey = result.apiKey;
    if (result.headers !== undefined) auth.headers = result.headers;
    return auth;
  }
  catch (err) {
    console.error(
      `auto-mode: getApiKeyAndHeaders failed for ${String(model.provider)}/${model.id}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Find the single cheapest model across all providers (for error context).
 *
 * @param ctx - extension context
 *
 * @param allModels - all available models
 *
 * @param majorVersions - how many major version families to search
 *
 * @returns the cheapest candidate, or `null` if none found
 *
 * @example
 * ```typescript
 * const cheapest = await findCheapestCandidate(ctx, models, 1);
 * ```
 */
async function findCheapestCandidate(
  ctx: ExtensionContext,
  allModels: Model<Api>[],
  majorVersions: number,
): Promise<ModelCandidate | null> {
  const { findCheapestInMajorVersions, } = await import("./budget-model-version.ts");
  const byProvider = new Map<string, Model<Api>[]>();
  for (const m of allModels) {
    const p = String(m.provider);
    if (!byProvider.has(p)) byProvider.set(
      p,
      []
    );
    const list = byProvider.get(p);
    if (list !== undefined) list.push(m);
  }

  let best: {
    model: Model<Api>;
    provider: string
  } | null = null;
  for (const [provider, models] of byProvider) {
    const candidates = findCheapestInMajorVersions(
      models,
      majorVersions
    );
    const [firstCandidate] = candidates;
    if (
      firstCandidate !== undefined &&
      (best === null || firstCandidate.cost.input < best.model.cost.input)
    ) {
      best = {
        model: firstCandidate,
        provider
      };
    }
  }

  if (best === null) return null;
  return toCandidate(
    ctx,
    best.model,
    best.provider
  );
}

//endregion

export {
  NoBudgetModelError,
  findCheapestCandidate,
  resolveAuth,
  toCandidate,
};
export type { ModelCandidate, };
