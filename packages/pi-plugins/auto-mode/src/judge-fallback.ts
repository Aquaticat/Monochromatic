/**
 * Judge-model fallback race after one selected model exhausts every internal attempt.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { NoBudgetModelError, } from '@monochromatic-dev/pi-shared-model-selection/ts';

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
  /**
   * Judge that supplied the verdict.
   */
  readonly judge: BudgetModel;
  /**
   * Parsed verdict that settled the fallback race.
   */
  readonly verdict: Verdict;
};

/**
 * One or two authenticated fallback judges available after primary failure.
 */
type FallbackJudgeContenders =
  | readonly []
  | readonly [BudgetModel]
  | readonly [
    BudgetModel,
    BudgetModel,
  ];

/**
 * Render canonical identity of a locally selected judge model.
 *
 * This local adapter reads only immutable identity fields, rather than handing
 * Pi's mutable model record to external model-selection helpers.
 *
 * @param model - selected judge model's immutable identity fields
 *
 * @returns provider and model identifier separated by a slash
 *
 * @example
 * ```typescript
 * judgeModelSlug({ model: judge.model });
 * ```
 */
function judgeModelSlug(
  {
    model,
  }: {
    readonly model: {
      readonly provider: string;
      readonly id: string;
    };
  },
): string {
  /**
   * Provider identity kept separate from model identity for readable interpolation.
   */
  const { provider, } = model;
  /**
   * Model identity paired with provider identity.
   */
  const { id, } = model;
  return `${provider}/${id}`;
}

/**
 * Convert an unknown thrown value to stable diagnostic text.
 *
 * @param error - thrown value to describe
 *
 * @returns error message or stable category for non-Error values
 *
 * @example
 * ```typescript
 * describeError(new Error('unavailable'));
 * ```
 */
function describeError(
  error: unknown,
): string {
  if (Error.isError(error,))
    return error.message;
  if ((typeof error) === 'string')
    return error;
  if ((typeof error) === 'number')
    return `${error}`;
  if ((typeof error) === 'boolean')
    return `${error}`;
  if ((typeof error) === 'bigint')
    return `${error}n`;
  if (error === null)
    return 'null';
  if (error === undefined)
    return 'undefined';
  if ((typeof error) === 'symbol')
    return 'symbol';
  if ((typeof error) === 'function')
    return 'function';
  return 'non-Error object';
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
  const fallbackModelSlug = judgeModelSlug({ model: fallbackJudge.model, },);
  if (excludedModelSlugs.includes(fallbackModelSlug,)) {
    throw new Error(
      `Fallback judge resolver selected an excluded model: ${fallbackModelSlug}`,
    );
  }
  return fallbackJudge;
}

/**
 * Resolve up to two distinct fallbacks before either model receives a judge request.
 *
 * When the second contender is unavailable, the first fallback still runs.
 * With no selected fallback, the caller falls back to explicit user approval.
 *
 * @param firstJudge - primary judge whose complete attempt failed
 *
 * @param resolveFallbackJudge - resolver that excludes earlier race participants
 *
 * @returns one or two distinct authenticated fallback judges
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
): Promise<FallbackJudgeContenders> {
  /**
   * Primary model identity excluded from every fallback selection.
   */
  const firstModelSlug = judgeModelSlug({ model: firstJudge.model, },);
  try {
    /**
     * First contender, selected without starting any fallback transport.
     */
    const firstFallback = await resolveFreshFallback({
      excludedModelSlugs: [firstModelSlug,],
      resolveFallbackJudge,
    },);
    try {
      /**
       * Second contender, selected after excluding primary plus first fallback.
       */
      const secondFallback = await resolveFreshFallback({
        excludedModelSlugs: [
          firstModelSlug,
          judgeModelSlug({ model: firstFallback.model, },),
        ],
        resolveFallbackJudge,
      },);
      return [
        firstFallback,
        secondFallback,
      ];
    }
    catch (error) {
      if (error instanceof NoBudgetModelError)
        return [firstFallback,];
      throw error;
    }
  }
  catch (error) {
    if (error instanceof NoBudgetModelError)
      return [];
    throw error;
  }
}

/**
 * Execute one fallback's complete judge attempt inside the shared race.
 *
 * @param judge - contender whose full transport sequence should run
 *
 * @param callJudgeAttempt - complete per-model judge attempt
 *
 * @returns contender plus its valid verdict
 *
 * @throws Error labeled with the failed contender identity
 *
 * @example
 * ```typescript
 * const result = await runFallbackJudge({ judge, callJudgeAttempt });
 * ```
 */
async function runFallbackJudge(
  {
    judge,
    callJudgeAttempt,
  }: {
    readonly judge: BudgetModel;
    readonly callJudgeAttempt: (
      options: { readonly judge: BudgetModel; },
    ) => Promise<Verdict>;
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
  const modelSlug = judgeModelSlug({ model: judge.model, },);
  innerL.debug(`starting fallback judge contender ${modelSlug}`,);
  try {
    return {
      judge,
      verdict: await callJudgeAttempt({ judge, },),
    };
  }
  catch (error) {
    innerL.error(
      `fallback judge model ${modelSlug} failed all retries: ${describeError(error,)}`,
    );
    throw new Error(
      `fallback judge model ${modelSlug} failed all retries: ${describeError(error,)}`,
      { cause: error, },
    );
  }
}

/**
 * Call selected judge, then run up to two distinct fallback models after the
 * primary exhausts every internal retry. The first valid fallback verdict wins.
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
      options: { readonly judge: BudgetModel; },
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
  const firstModelSlug = judgeModelSlug({ model: firstJudge.model, },);
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
      FallbackJudgeContenders
    > {
      try {
        return await resolveFallbackRace({
          firstJudge,
          resolveFallbackJudge,
        },);
      }
      catch (error) {
        throw new Error(
          `Judge model ${firstModelSlug} failed all retries: ${describeError(firstError,)}; resolving up to two distinct fallback judge models failed: ${
            describeError(error,)
          }`,
          { cause: error, },
        );
      }
    })();
    if (fallbackJudges.length === 0) {
      throw new Error(
        `Judge model ${firstModelSlug} failed all retries; no fallback judge model is available.`,
      );
    }
    /**
     * Guaranteed first fallback contender after successful selection.
     */
    const [
      firstFallbackJudge,
      secondFallbackJudge,
    ] = fallbackJudges;
    /**
     * Complete attempt for first selected fallback contender.
     */
    const firstFallbackAttempt = runFallbackJudge({
      judge: firstFallbackJudge,
      callJudgeAttempt,
    },);
    /**
     * Concurrent complete attempts, one per selected fallback contender.
     */
    const fallbackAttempts = secondFallbackJudge === undefined
      ? [firstFallbackAttempt,]
      : [
        firstFallbackAttempt,
        runFallbackJudge({
          judge: secondFallbackJudge,
          callJudgeAttempt,
        },),
      ];
    /**
     * Model identities retained for all-fail diagnostics.
     */
    const fallbackModelSlugs = secondFallbackJudge === undefined
      ? [judgeModelSlug({ model: firstFallbackJudge.model, },),]
      : [
        judgeModelSlug({ model: firstFallbackJudge.model, },),
        judgeModelSlug({ model: secondFallbackJudge.model, },),
      ];
    try {
      /**
       * First successfully parsed fallback verdict, ignoring rejected contenders.
       */
      const winner = await Promise.any(fallbackAttempts,);
      /**
       * Judge that returned the first valid verdict.
       */
      const { judge: winningJudge, } = winner;
      /**
       * Canonical identity of contender that returned the first valid verdict.
       */
      const winnerModelSlug = judgeModelSlug({ model: winningJudge.model, },);
      innerL.debug(`fallback judge race winner: ${winnerModelSlug}`,);
      return winner.verdict;
    }
    catch (fallbackRaceError) {
      throw new Error(
        `Judge model ${firstModelSlug} failed all retries: ${describeError(firstError,)}; fallback judge race models ${
          fallbackModelSlugs.join(', ')
        } also failed all retries: ${describeRaceError(fallbackRaceError,)}`,
        { cause: fallbackRaceError, },
      );
    }
  }
}

export { callJudgeWithFallback, };
