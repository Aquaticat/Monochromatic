/**
 * Judge-model fallback after one selected model exhausts its internal attempts.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { budgetModelSlug, } from '@monochromatic-dev/pi-shared-model-selection/ts';

import type {
  BudgetModel,
  Verdict,
} from './types.ts';

/**
 * Logger root for auto-mode judge fallback.
 */
const parentLogger = tagged({ tag: 'auto-mode', },);

/**
 * Tagged logger for fallback model selection and attempts.
 */
const l = tagged({
  tag: 'judge-fallback',
  l: parentLogger,
},);

/**
 * Convert an unknown thrown value to stable diagnostic text.
 *
 * @param error - thrown value to describe
 *
 * @returns error message or stringified thrown value
 *
 * @example
 * ```typescript
 * describeError(new Error('unavailable'));
 * ```
 */
function describeError(
  error: unknown,
): string {
  return Error.isError(error,)
    ? error.message
    : String(error,);
}

/**
 * Resolve a fallback judge that differs from the failed first model.
 *
 * @param firstJudge - selected judge whose internal attempts failed
 *
 * @param firstError - terminal error from first judge
 *
 * @param resolveFallbackJudge - resolver that excludes failed model slug
 *
 * @returns distinct fallback judge
 *
 * @throws AggregateError when fallback resolution fails or returns first model again
 *
 * @example
 * ```typescript
 * const fallback = await resolveDistinctFallback({
 *   firstJudge,
 *   firstError,
 *   resolveFallbackJudge,
 * });
 * ```
 */
async function resolveDistinctFallback(
  {
    firstJudge,
    firstError,
    resolveFallbackJudge,
  }: {
    readonly firstJudge: BudgetModel;
    readonly firstError: unknown;
    readonly resolveFallbackJudge: (
      options: { readonly failedModelSlug: string; },
    ) => Promise<BudgetModel>;
  },
): Promise<BudgetModel> {
  /**
   * Canonical slug excluded from fallback selection.
   */
  const firstModelSlug = budgetModelSlug(firstJudge.model,);
  try {
    /**
     * Candidate selected after excluding first judge model.
     */
    const fallbackJudge = await resolveFallbackJudge({
      failedModelSlug: firstModelSlug,
    },);
    /**
     * Canonical fallback slug used to enforce distinct model identity.
     */
    const fallbackModelSlug = budgetModelSlug(fallbackJudge.model,);
    if (fallbackModelSlug === firstModelSlug) {
      throw new Error(
        `Fallback judge resolver selected failed model again: ${firstModelSlug}`,
      );
    }
    return fallbackJudge;
  }
  catch (fallbackResolutionError) {
    throw new AggregateError(
      [
        firstError,
        fallbackResolutionError,
      ],
      `Judge model ${firstModelSlug} failed all retries; selecting another judge model failed: ${
        describeError(fallbackResolutionError,)
      }`,
      { cause: fallbackResolutionError, },
    );
  }
}

/**
 * Call selected judge, then select and call one distinct fallback model when
 * first judge exhausts every retry inside its attempt.
 *
 * @param firstJudge - initially selected judge model and auth
 *
 * @param resolveFallbackJudge - selects another authenticated model after first failure
 *
 * @param callJudgeAttempt - runs all transport attempts for one selected model
 *
 * @returns verdict from first successful judge model
 *
 * @throws AggregateError when fallback selection or fallback judge also fails
 *
 * @example
 * ```typescript
 * const verdict = await callJudgeWithFallback({
 *   firstJudge,
 *   resolveFallbackJudge,
 *   callJudgeAttempt,
 * });
 * ```
 */
async function callJudgeWithFallback(
  {
    firstJudge,
    resolveFallbackJudge,
    callJudgeAttempt,
  }: {
    readonly firstJudge: BudgetModel;
    readonly resolveFallbackJudge: (
      options: { readonly failedModelSlug: string; },
    ) => Promise<BudgetModel>;
    readonly callJudgeAttempt: (
      options: { readonly judge: BudgetModel; },
    ) => Promise<Verdict>;
  },
): Promise<Verdict> {
  /**
   * Per-call logger carrying function boundary tag.
   */
  const innerL = tagged({
    tag: callJudgeWithFallback.name,
    l,
  },);
  /**
   * Canonical first model slug used in diagnostics.
   */
  const firstModelSlug = budgetModelSlug(firstJudge.model,);
  try {
    return await callJudgeAttempt({ judge: firstJudge, },);
  }
  catch (firstError) {
    innerL.error(
      `judge model ${firstModelSlug} failed all retries: ${describeError(firstError,)}`,
    );
    /**
     * Distinct authenticated judge selected after first model failure.
     */
    const fallbackJudge = await resolveDistinctFallback({
      firstJudge,
      firstError,
      resolveFallbackJudge,
    },);
    /**
     * Canonical fallback slug used for audit logging and errors.
     */
    const fallbackModelSlug = budgetModelSlug(fallbackJudge.model,);
    innerL.warn(`retrying judge with fallback model ${fallbackModelSlug}`,);
    try {
      return await callJudgeAttempt({ judge: fallbackJudge, },);
    }
    catch (fallbackError) {
      innerL.error(
        `fallback judge model ${fallbackModelSlug} failed all retries: ${describeError(fallbackError,)}`,
      );
      throw new AggregateError(
        [
          firstError,
          fallbackError,
        ],
        `Judge model ${firstModelSlug} failed all retries; fallback judge model ${fallbackModelSlug} also failed all retries: ${
          describeError(fallbackError,)
        }`,
        { cause: fallbackError, },
      );
    }
  }
}

export { callJudgeWithFallback, };
