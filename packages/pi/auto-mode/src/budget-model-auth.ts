/**
 * Auto-mode registry adapters for shared budget-model selection.
 *
 * @module
 */

import type {
  Api,
  Model,
} from '@earendil-works/pi-ai';
import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  ABSENT,
  type Maybe,
} from '@monochromatic-dev/pi-shared-model-selection/core';
import type { BudgetModelAuth, } from '@monochromatic-dev/pi-shared-model-selection/budget';
import { tagged, } from '@monochromatic-dev/module-logger/tagged';
import { l as parentLogger, } from './log.ts';

/** Tagged logger for budget-model auth adapters. */
const l = tagged({
  tag: 'budget-model-auth',
  l: parentLogger,
},);

//region Registry auth adapters

/**
 * Resolve auth for a model via auto-mode's pi model registry.
 *
 * Uses `getApiKeyAndHeaders` instead of upstream's broken `getApiKey`.
 *
 * @param ctx - pi extension context exposing model registry
 *
 * @param model - model to authenticate
 *
 * @returns auth details, or {@link ABSENT} when resolution failed
 *
 * @example
 * ```typescript
 * const auth = await resolveBudgetAuth({ ctx, model });
 * ```
 */
async function resolveBudgetAuth(
  {
    ctx,
    model,
  }: {
    readonly ctx: ExtensionContext;
    readonly model: Model<Api>;
  },
): Promise<Maybe<BudgetModelAuth>> {
  try {
    /** Registry response carrying `ok` plus optional `apiKey` and `headers`. */
    const result = await ctx.modelRegistry
      .getApiKeyAndHeaders(model,);
    if (!result.ok)
      return ABSENT;
    /** Output auth object assembled field-by-field so omitted keys stay absent. */
    const auth: BudgetModelAuth = {};
    if (result.apiKey
      !== undefined)
      return result.headers === undefined
        ? { apiKey: result.apiKey, }
        : {
          apiKey: result.apiKey,
          headers: result.headers,
        };
    if (result.headers
      !== undefined)
      return { headers: result.headers, };
    return auth;
  }
  catch (error) {
    /** Per-call sub-logger so lines from this entry point carry function name. */
    const innerL = tagged({
      tag: resolveBudgetAuth.name,
      l,
    },);
    innerL.error(
      `getApiKeyAndHeaders failed for ${model.provider}/${model.id}: ${
        error instanceof Error ? error.message : String(error,)
      }`,
    );
    return ABSENT;
  }
}

/**
 * Check whether registry reports configured auth for a model.
 *
 * @param ctx - pi extension context exposing model registry
 *
 * @param model - model to check
 *
 * @returns whether auth is configured
 *
 * @example
 * ```typescript
 * hasConfiguredBudgetAuth({ ctx, model });
 * ```
 */
function hasConfiguredBudgetAuth(
  {
    ctx,
    model,
  }: {
    readonly ctx: ExtensionContext;
    readonly model: Model<Api>;
  },
): boolean {
  return ctx.modelRegistry
    .hasConfiguredAuth(model,);
}

/**
 * Find an override model in auto-mode's registry.
 *
 * @param ctx - pi extension context exposing model registry
 *
 * @param provider - provider slug
 *
 * @param modelId - model id
 *
 * @returns matched model, or {@link ABSENT} when missing
 *
 * @example
 * ```typescript
 * findBudgetOverrideModel({ ctx, provider: 'openai', modelId: 'gpt-4o-mini' });
 * ```
 */
function findBudgetOverrideModel(
  {
    ctx,
    provider,
    modelId,
  }: {
    readonly ctx: ExtensionContext;
    readonly provider: string;
    readonly modelId: string;
  },
): Maybe<Model<Api>> {
  /* oxlint-disable unicorn/no-array-method-this-argument -- ModelRegistry.find is not Array.find. */
  /** Registry-resolved model record, when present. */
  const model = ctx.modelRegistry
    .find(
      provider,
      modelId,
    );
  /* oxlint-enable unicorn/no-array-method-this-argument */
  return (model === undefined) || (model === null)
    ? ABSENT
    : model;
}

//endregion Registry auth adapters

export {
  findBudgetOverrideModel,
  hasConfiguredBudgetAuth,
  resolveBudgetAuth,
};
