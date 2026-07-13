/**
 * Judge-model fallback race after one selected model exhausts every internal attempt.
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
 * Successful fallback attempt paired with its source model for winner logging.
 */
type FallbackJudgeResult = {
  /** Judge that supplied the verdict. */
  readonly judge: BudgetModel;
  /** Parsed verdict that settled the fallback race. */
  readonly verdict: Verdict;
};

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
 * Render every rejected contender from a `Promise.any` fallback race.
 *
 * @param error - terminal race error, usually an `AggregateError`
 *
 * @returns semicolon-delimited contender diagnostics
 *
 * @example
 * ```typescript
 * describeRaceError(new AggregateError([new Error('one'), new Error('two')]));
 * ```
 */
function describeRaceError(
  error: unknown,
): string {
  if (error instanceof AggregateError) {
    return error.errors
      .map(describeError,)
      .join('; ',);
  }
  return describeError(error,);
}

/**
 * Select one fallback judge that is not any previously failed or selected model.
 *
 * @param excludedModelSlugs - canonical model identities unavailable to this race
 *
 * @param resolveFallbackJudge - resolver that honours all excluded model identities
 *
 * @returns one newly selected fallback judge
 *
 * @throws Error when selection returns an excluded model
 *
 * @example
 * ```typescript
 * const fallback = await resolveFreshFallback({
 *   excludedModelSlugs: ['provider/failed'],
 *   resolveFallbackJudge,
 * });
 * ```
 */
async function resolveFreshFallback(
  {
    excludedModelSlugs,
    resolveFallbackJudge,
  }: {
    readonly excludedModelSlugs: readonly string[];
    readonly resolveFallbackJudge: (
      options: { readonly excludedModelSlugs: readonly string[]; },
    ) => Promise<BudgetModel>;
  },
): Promise<BudgetModel> {
  /**
   * Candidate selected after excluding every prior race participant.
   */
  const fallbackJudge = await resolveFallbackJudge({ excludedModelSlugs, },);
  /**
   * Canonical candidate identity used to prevent duplicate provider calls.
   */
  const fallbackModelSlug = budgetModelSlug(fallbackJudge.model,);
  if (excludedModelSlugs.includes(fallbackModelSlug,)) {
    throw new Error(
      `Fallback judge resolver selected an excluded model: ${fallbackModelSlug}`,
    );
  }
  return fallbackJudge;
}

/**
 * Resolve two distinct fallbacks before either model receives a judge request.
 *
 * A partial fallback is deliberately not run: a two-model race requires both
 * contenders, otherwise the caller falls back to explicit user approval.
 *
 * @param firstJudge - primary judge whose complete attempt failed
 *
 * @param resolveFallbackJudge - resolver that excludes earlier race participants
 *
 * @returns two distinct authenticated fallback judges
 *
 * @example
 * ```typescript
 * const fallbacks = await resolveFallbackRace({ firstJudge, resolveFallbackJudge });
 * ```
 */
async function resolveFallbackRace(
  {
    firstJudge,
    resolveFallbackJudge,
  }: {
    readonly firstJudge: BudgetModel;
    readonly resolveFallbackJudge: (
      options: { readonly excludedModelSlugs: readonly string[]; },
    ) => Promise<BudgetModel>;
  },
): Promise<readonly [BudgetModel, BudgetModel]> {
  /**
   * Primary model identity excluded from every fallback selection.
   */
  const firstModelSlug = budgetModelSlug(firstJudge.model,);
  /**
   * First contender, selected without starting any fallback transport.
   */
  const firstFallback = await resolveFreshFallback({
    excludedModelSlugs: [firstModelSlug,],
    resolveFallbackJudge,
  },);
  /**
   * Second contender, selected after excluding primary plus first fallback.
   */
  const secondFallback = await resolveFreshFallback({
    excludedModelSlugs: [
      firstModelSlug,
      budgetModelSlug(firstFallback.model,),
    ],
    resolveFallbackJudge,
  },);
  return [
    firstFallback,
    secondFallback,
  ];
}

/**
 * Execute one fallback's complete judge attempt inside the shared race.
 *
 * @param judge - contender whose full transport sequence should run
 *
 * @param callJudgeAttempt - complete per-model judge attempt
 *
 * @param abortSignal - abort signal triggered after another contender returns a verdict
 *
 * @returns contender plus its valid verdict
 *
 * @throws Error labeled with the failed contender identity
 *
 * @example
 * ```typescript
 * const result = await runFallbackJudge({ judge, callJudgeAttempt, abortSignal });
 * ```
 */
async function runFallbackJudge(
  {
    judge,
    callJudgeAttempt,
    abortSignal,
  }: {
    readonly judge: BudgetModel;
    readonly callJudgeAttempt: (
      options: { readonly judge: BudgetModel; readonly abortSignal?: AbortSignal; },
    ) => Promise<Verdict>;
    readonly abortSignal: AbortSignal;
  },
): Promise<FallbackJudgeResult> {
  /**
   * Per-call logger carrying the function boundary tag.
   */
  const innerL = tagged({
    tag: runFallbackJudge.name,
    l,
  },);
  /**
   * Canonical contender identity used in logs and errors.
   */
  const modelSlug = budgetModelSlug(judge.model,);
  innerL.debug(`starting fallback judge contender ${modelSlug}`,);
  try {
    return {
      judge,
      verdict: await callJudgeAttempt({
        judge,
        abortSignal,
      },),
    };
  }
  catch (error) {
    if (abortSignal.aborted) {
      innerL.debug(`fallback judge contender ${modelSlug} cancelled after another verdict`,);
    }
    else {
      innerL.error(
        `fallback judge model ${modelSlug} failed all retries: ${describeError(error,)}`,
      );
    }
    throw new Error(
      `fallback judge model ${modelSlug} failed all retries: ${describeError(error,)}`,
      { cause: error, },
    );
  }
}

/**
 * Call selected judge, then race two distinct fallback models after the primary
 * exhausts every internal retry. The first valid fallback verdict wins.
 *
 * @param firstJudge - initially selected judge model and auth
 *
 * @param resolveFallbackJudge - selects one authenticated model outside supplied exclusions
 *
 * @param callJudgeAttempt - runs all transport attempts for one selected model
 *
 * @returns verdict from primary or first successful fallback contender
 *
 * @throws Error when fallback selection fails or both fallback contenders fail
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
      options: { readonly excludedModelSlugs: readonly string[]; },
    ) => Promise<BudgetModel>;
    readonly callJudgeAttempt: (
      options: { readonly judge: BudgetModel; readonly abortSignal?: AbortSignal; },
    ) => Promise<Verdict>;
  },
): Promise<Verdict> {
  /**
   * Per-call logger carrying the function boundary tag.
   */
  const innerL = tagged({
    tag: callJudgeWithFallback.name,
    l,
  },);
  /**
   * Canonical primary model identity used in diagnostics.
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
     * Fully resolved fallback contenders, ready to start concurrently.
     */
    const fallbackJudges = await (async function resolveFallbackContenders(): Promise<
      readonly [BudgetModel, BudgetModel]
    > {
      try {
        return await resolveFallbackRace({
          firstJudge,
          resolveFallbackJudge,
        },);
      }
      catch (error) {
        throw new Error(
          `Judge model ${firstModelSlug} failed all retries: ${describeError(firstError,)}; resolving two distinct fallback judge models failed: ${
            describeError(error,)
          }`,
          { cause: error, },
        );
      }
    })();
    /**
     * Shared cancellation source that stops the losing fallback request after a verdict wins.
     */
    const raceController = new AbortController();
    /**
     * Concurrent complete attempts, one per already-distinct fallback contender.
     */
    const fallbackAttempts = fallbackJudges.map(function startFallbackJudge(judge,) {
      return runFallbackJudge({
        judge,
        callJudgeAttempt,
        abortSignal: raceController.signal,
      },);
    },);
    try {
      /**
       * First successfully parsed fallback verdict, ignoring rejected contenders.
       */
      const winner = await Promise.any(fallbackAttempts,);
      raceController.abort();
      innerL.debug(
        `fallback judge race winner: ${budgetModelSlug(winner.judge.model,)}`,
      );
      return winner.verdict;
    }
    catch (fallbackRaceError) {
      raceController.abort();
      throw new Error(
        `Judge model ${firstModelSlug} failed all retries: ${describeError(firstError,)}; fallback judge race models ${
          fallbackJudges
            .map(function fallbackSlug(judge,) {
              return budgetModelSlug(judge.model,);
            },)
            .join(', ')
        } also failed all retries: ${describeRaceError(fallbackRaceError,)}`,
        { cause: fallbackRaceError, },
      );
    }
  }
}

export { callJudgeWithFallback, };
