/**
 * Concrete auto-mode reviewer availability fallback.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type {
  ForeignBorrowed,
  ForeignHostCapability,
} from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  ReviewUnavailableError,
  type ScriptedStructuredReviewTransport,
} from '@monochromatic-dev/pi-shared-model-review/ts';

import { findBudgetModel, } from './budget-model.ts';
import { NoBudgetModelError, } from './budget-model-error.ts';
import { budgetModelSlug, } from './budget-model-identity.ts';
import {
  createJudgeCallHistory,
  type JudgeCallHistory,
} from './judge-call-history.ts';
import {
  callJudge,
  EmptyJudgeResponseError,
} from './judge.ts';
import type {
  BatchEntry,
  BudgetModel,
  Verdict,
} from './types.ts';

/**
 * Auto-mode fallback logger.
 */
const l = tagged({ tag: 'auto-mode-judge-fallback', },);

/**
 * Sentinel for unavailable second fallback judge.
 */
const NO_SECOND_FALLBACK: unique symbol = Symbol('second fallback judge unavailable',);

/**
 * Request data shared by every candidate attempt.
 *
 * @example
 * ```ts
 * const request: JudgeReviewRequest = {
 *   action: 'write src/index.ts',
 *   actionInput: '{}',
 *   cwd: '/project',
 *   recentContext: '',
 *   trustDirectives: [],
 *   timeoutMs: 60_000,
 *   systemPrompt: 'Judge.',
 *   batchContext: [],
 * };
 * ```
 */
type JudgeReviewRequest = {
  /**
   * Human-readable action under review.
   */
  readonly action: string;
  /**
   * Complete current tool input encoded as JSON.
   */
  readonly actionInput: string;
  /**
   * Agent working directory.
   */
  readonly cwd: string;
  /**
   * Complete selected user-visible session messages as canonical JSON.
   */
  readonly recentContext: string;
  /**
   * Active trust directives.
   */
  readonly trustDirectives: readonly string[];
  /**
   * Complete candidate-attempt timeout.
   */
  readonly timeoutMs: number;
  /**
   * Auto-mode judge rubric.
   */
  readonly systemPrompt: string;
  /**
   * Sibling batch decisions.
   */
  readonly batchContext: readonly BatchEntry[];
  /**
   * Optional data-only deterministic provider seam.
   */
  readonly testTransport?: ForeignBorrowed<ScriptedStructuredReviewTransport>;
};

/**
 * Successful fallback attempt paired with judge identity.
 *
 * @example
 * ```ts
 * const result: JudgeAttemptSuccess = { identity: 'openai/model', verdict };
 * ```
 */
type JudgeAttemptSuccess = {
  /**
   * Canonical selected judge identity.
   */
  readonly identity: string;
  /**
   * Strict judge verdict.
   */
  readonly verdict: Verdict;
};

/**
 * Call one judge and record whether complete logical response was wholly empty.
 *
 * @param judge - authenticated judge selected for current attempt
 *
 * @param request - complete shared review request data
 *
 * @param callHistory - session-local per-model outcome history
 *
 * @returns strict auto-mode verdict
 *
 * @mutates judge - concrete provider transport consumes model and auth data
 *
 * @mutates request - provider transport consumes optional test script data
 *
 * @mutates callHistory - appends completed logical call outcome for selected model
 *
 * @example
 * ```ts
 * await callJudgeAndRecordOutcome({ judge, request, callHistory });
 * ```
 */
async function callJudgeAndRecordOutcome(
  {
    judge,
    request,
    callHistory,
  }: {
    readonly judge: ForeignBorrowed<BudgetModel>;
    readonly request: ForeignBorrowed<JudgeReviewRequest>;
    readonly callHistory: JudgeCallHistory;
  },
): Promise<Verdict> {
  /**
   * Canonical model identity indexing session-local health history.
   */
  const identity = budgetModelSlug(judge.model,);
  try {
    /**
     * Strict verdict proving current logical call produced usable content.
     */
    const verdict = await callJudge({
      model: judge.model,
      auth: judge.auth,
      ...request,
    },);
    callHistory.record({
      modelSlug: identity,
      outcome: 'other',
    },);
    return verdict;
  }
  catch (error) {
    callHistory.record({
      modelSlug: identity,
      outcome: error instanceof EmptyJudgeResponseError
        ? 'noContent'
        : 'other',
    },);
    throw error;
  }
}

/**
 * Run one concrete fallback attempt and record candidate-labeled failure.
 *
 * @param judge - authenticated fallback judge
 *
 * @param request - shared review request data
 *
 * @param diagnostics - local complete failure audit
 *
 * @param callHistory - session-local per-model outcome history
 *
 * @returns successful labeled verdict
 *
 * @mutates judge - concrete provider transport consumes model and auth data
 *
 * @mutates request - provider transport consumes optional test script data
 *
 * @mutates diagnostics - records normalized attempt failure
 *
 * @mutates callHistory - appends completed logical call outcome for fallback model
 *
 * @example
 * ```ts
 * await runFallbackAttempt({ judge, request, diagnostics, callHistory });
 * ```
 */
async function runFallbackAttempt(
  {
    judge,
    request,
    diagnostics,
    callHistory,
  }: {
    readonly judge: ForeignBorrowed<BudgetModel>;
    readonly request: ForeignBorrowed<JudgeReviewRequest>;
    readonly diagnostics: string[];
    readonly callHistory: JudgeCallHistory;
  },
): Promise<JudgeAttemptSuccess> {
  /**
   * Canonical identity used for logs and audit.
   */
  const identity = budgetModelSlug(judge.model,);
  l.debug(`starting fallback reviewer ${identity}`,);
  try {
    return {
      identity,
      verdict: await callJudgeAndRecordOutcome({
        judge,
        request,
        callHistory,
      },),
    };
  }
  catch (error) {
    /**
     * Candidate-labeled normalized error.
     */
    const diagnostic = `${identity}: ${caughtValueText(error,)}`;
    diagnostics[diagnostics.length] = diagnostic;
    l.error(`fallback reviewer failed: ${diagnostic}`,);
    throw new Error(
      diagnostic,
      { cause: error, },
    );
  }
}

/**
 * Run initial judge then at most two distinct concurrent fallback judges.
 *
 * @param firstJudge - initially selected authenticated judge
 *
 * @param ctx - Pi context used only when initial attempt fails
 *
 * @param request - complete callback-free judge request data
 *
 * @param callHistory - session-local per-model outcome history and temporary blocklist
 *
 * @returns first valid auto-mode verdict
 *
 * @mutates firstJudge - concrete provider transport consumes model and auth data
 *
 * @mutates ctx - fallback selection can invoke registry and command-backed auth
 *
 * @mutates request - provider transport consumes optional test script data
 *
 * @mutates callHistory - every completed candidate call appends one model outcome
 *
 * @throws {@link ReviewUnavailableError} when every available attempt fails
 *
 * @example
 * ```ts
 * const verdict = await callJudgeWithFallback({ firstJudge, ctx, request, callHistory });
 * ```
 */
async function callJudgeWithFallback(
  {
    firstJudge,
    ctx,
    request,
    callHistory = createJudgeCallHistory(),
  }: {
    readonly firstJudge: ForeignBorrowed<BudgetModel>;
    readonly ctx: ForeignHostCapability<ExtensionContext>;
    readonly request: ForeignBorrowed<JudgeReviewRequest>;
    readonly callHistory?: JudgeCallHistory;
  },
): Promise<Verdict> {
  /**
   * Initial canonical judge identity.
   */
  const firstIdentity = budgetModelSlug(firstJudge.model,);
  /**
   * Candidate identities whose transports started.
   */
  const attemptedCandidateIdentities: string[] = [firstIdentity,];
  /**
   * Normalized selection and transport failures.
   */
  const diagnostics: string[] = [];
  try {
    return await callJudgeAndRecordOutcome({
      judge: firstJudge,
      request,
      callHistory,
    },);
  }
  catch (error) {
    diagnostics[diagnostics.length] = `${firstIdentity}: ${caughtValueText(error,)}`;
    l.error(`initial reviewer failed: ${diagnostics[0]}`,);
  }

  /**
   * First distinct fallback, or availability exhaustion.
   */
  const firstFallbackResult = await (async function resolveFirstFallback(): Promise<
    | {
      readonly available: true;
      readonly judge: BudgetModel
    }
    | { readonly available: false; }
  > {
    try {
      return {
        available: true,
        judge: await findBudgetModel({
          ctx,
          excludedModelSlugs: [
            firstIdentity,
            ...callHistory.blocklistedModelSlugs(),
          ],
        },),
      };
    }
    catch (error) {
      if (error instanceof NoBudgetModelError)
        return { available: false, };
      throw new ReviewUnavailableError({
        attemptedCandidateIdentities,
        diagnostics: [
          ...diagnostics,
          `fallback selection: ${caughtValueText(error,)}`,
        ],
        cause: error,
      },);
    }
  })();
  if (!firstFallbackResult.available) {
    throw new ReviewUnavailableError({
      attemptedCandidateIdentities,
      diagnostics: [
        ...diagnostics,
        'no distinct fallback reviewer is available',
      ],
    },);
  }
  /**
   * First distinct fallback judge.
   */
  const firstFallback = firstFallbackResult.judge;
  /**
   * First fallback canonical identity.
   */
  const firstFallbackIdentity = budgetModelSlug(firstFallback.model,);
  /**
   * Exclusions used to seek optional second distinct fallback.
   */
  const secondExclusions = [
    firstIdentity,
    firstFallbackIdentity,
  ];
  /**
   * Optional second distinct fallback judge.
   */
  const secondFallback = await (async function resolveSecondFallback(): Promise<
    BudgetModel | typeof NO_SECOND_FALLBACK
  > {
    try {
      return await findBudgetModel({
        ctx,
        excludedModelSlugs: [
          ...secondExclusions,
          ...callHistory.blocklistedModelSlugs(),
        ],
      },);
    }
    catch (error) {
      if (error instanceof NoBudgetModelError)
        return NO_SECOND_FALLBACK;
      throw new ReviewUnavailableError({
        attemptedCandidateIdentities,
        diagnostics: [
          ...diagnostics,
          `fallback selection: ${caughtValueText(error,)}`,
        ],
        cause: error,
      },);
    }
  })();

  attemptedCandidateIdentities.push(firstFallbackIdentity,);
  /**
   * Concurrent fallback attempts started before first await.
   */
  const fallbackAttempts: Promise<JudgeAttemptSuccess>[] = [
    runFallbackAttempt({
      judge: firstFallback,
      request,
      diagnostics,
      callHistory,
    },),
  ];
  if ((typeof secondFallback) !== 'symbol') {
    attemptedCandidateIdentities.push(budgetModelSlug(secondFallback.model,),);
    fallbackAttempts.push(runFallbackAttempt({
      judge: secondFallback,
      request,
      diagnostics,
      callHistory,
    },),);
  }
  try {
    /**
     * First fulfilled strict verdict; rejected transports do not settle race.
     */
    const winner = await Promise.any(fallbackAttempts,);
    l.debug(`fallback reviewer race winner: ${winner.identity}`,);
    return winner.verdict;
  }
  catch (error) {
    throw new ReviewUnavailableError({
      attemptedCandidateIdentities,
      diagnostics,
      cause: error,
    },);
  }
}

export { callJudgeWithFallback, };
export type { JudgeReviewRequest, };
