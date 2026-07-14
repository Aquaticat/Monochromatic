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
  type BudgetModelAuth,
  NO_AUTH,
  NO_OVERRIDE_MODEL,
} from '@monochromatic-dev/pi-shared-model-selection/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Logger root for auto-mode after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: parentLogger, },);
 * ```
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for budget-model auth adapters.
 */
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
 * @returns auth details, or {@link NO_AUTH} when resolution failed
 *
 * @mutates ctx - `ctx.modelRegistry.getApiKeyAndHeaders` can run command-backed auth
 *
 * @mutates model - registry auth reads can invoke caller-owned model accessors or proxy traps
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
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly model: ForeignBorrowed<Model<Api>>;
  },
): Promise<BudgetModelAuth | typeof NO_AUTH> {
  try {
    /**
     * Registry response carrying `ok` plus optional `apiKey` and `headers`.
     */
    const result = await ctx.modelRegistry
      .getApiKeyAndHeaders(model,);
    if (!result.ok)
      return NO_AUTH;
    /**
     * Output auth object assembled field-by-field so omitted keys stay absent.
     */
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
    /**
     * Per-call sub-logger so lines from this entry point carry function name.
     */
    const innerL = tagged({
      tag: resolveBudgetAuth.name,
      l,
    },);
    innerL.error(
      `getApiKeyAndHeaders failed for ${model.provider}/${model.id}: ${
        Error.isError(error,) ? error.message : `non-Error ${typeof error}`
      }`,
    );
    return NO_AUTH;
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
 * @mutates model - `hasConfiguredAuth` reads can invoke caller-owned model accessors or proxy traps
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
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly model: ForeignBorrowed<Model<Api>>;
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
 * @returns matched model, or {@link NO_OVERRIDE_MODEL} when missing
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
    readonly ctx: ForeignBorrowed<ExtensionContext>;
    readonly provider: string;
    readonly modelId: string;
  },
): Model<Api> | typeof NO_OVERRIDE_MODEL {
  /* oxlint-disable unicorn/no-array-method-this-argument -- ModelRegistry.find is not Array.find. */
  /**
   * Registry-resolved model record, when present.
   */
  const model = ctx.modelRegistry
    .find(
      provider,
      modelId,
    );
  /* oxlint-enable unicorn/no-array-method-this-argument */
  return (model === undefined) || (model === null)
    ? NO_OVERRIDE_MODEL
    : model;
}

//endregion Registry auth adapters

export {
  findBudgetOverrideModel,
  hasConfiguredBudgetAuth,
  resolveBudgetAuth,
};
