/**
 * Model-override resolution for the budget model.
 *
 * Skips auto-selection when the judge config pins a specific model,
 * resolving its registry record plus auth (or inline auth supplied in
 * the override struct).
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import {
  NoBudgetModelError,
  resolveAuth,
} from './budget-model-auth.ts';
import type {
  BudgetModel,
  BudgetModelAuth,
  ModelOverride,
} from './types.ts';

/**
 * Resolve a model override: skip auto-selection entirely.
 *
 * @param ctx - extension context exposing the model registry
 *
 * @param override - pinned model id, or `{ model, auth }` with inline auth
 *
 * @throws NoBudgetModelError when the override is absent from the registry
 *   or the registry has no API key for it
 *
 * @returns budget model with auth credentials
 *
 * @example
 * ```typescript
 * const budget = await resolveModelOverride({ ctx, override: 'openai/gpt-4o-mini' });
 * ```
 */
async function resolveModelOverride(
  {
    ctx,
    override,
  }: {
    readonly ctx: ExtensionContext;
    readonly override: ModelOverride;
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
  const model = ctx.modelRegistry
    .find(
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
  const authResult = await resolveAuth({
    ctx,
    model,
  },);
  if (!authResult.found) {
    throw new NoBudgetModelError(
      `no API key for model override "${modelId}"`,
    );
  }

  return {
    model,
    auth: authResult.auth,
  };
}

export { resolveModelOverride, };
