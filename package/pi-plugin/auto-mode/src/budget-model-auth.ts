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
} from '@monochromatic-dev/pi-shared-model-selection/ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
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
        caughtValueText(error,)
      }`,
    );
    return NO_AUTH;
  }
}

/**
 * Check whether registry reports available auth for a model.
 *
 * @param ctx - pi extension context exposing model registry
 *
 * @param model - model to check
 *
 * @returns whether registry auth is available
 *
 * @mutates model - registry auth reads can invoke caller-owned model accessors or proxy traps
 *
 * @example
 * ```typescript
 * hasRegistryBudgetAuth({ ctx, model });
 * ```
 */
function hasRegistryBudgetAuth(
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

//endregion Registry auth adapters

export {
  hasRegistryBudgetAuth,
  resolveBudgetAuth,
};
