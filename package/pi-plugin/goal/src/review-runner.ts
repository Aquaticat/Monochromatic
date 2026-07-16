/**
 * Goal reviewer transport orchestration over ranked authenticated pool.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { canonicalSlug, } from '@monochromatic-dev/pi-shared-model-selection/ts';
import {
  ReviewUnavailableError,
  runReviewWithFallback,
  runStructuredReviewAttempt,
} from '@monochromatic-dev/pi-shared-model-review/ts';

import {
  REVIEW_OUTPUT_TOKENS,
  REVIEW_TIMEOUT_MS,
} from './constants.ts';
import type {
  GoalCompletionReview,
  GoalCompletionReviewer,
  GoalReviewerCandidate,
  GoalReviewVerdict,
} from './completion-types.ts';
import { buildGoalReviewEvidence, } from './review-context.ts';
import { GOAL_REVIEW_CONTRACT, } from './review-contract.ts';
import {
  NoEligibleGoalReviewerError,
  type GoalReviewerPool,
  resolveGoalReviewerPool,
} from './review-selection.ts';

/**
 * Reviewer orchestration logger.
 */
const reviewRunnerLogger = tagged({ tag: 'pi-goal-review-runner', },);

/**
 * Complete candidate attempt capability for production and deterministic tests.
 */
type GoalReviewerAttempt = (
  input: {
    readonly candidate: GoalReviewerCandidate;
    readonly signal?: AbortSignal;
  },
) => Promise<GoalReviewVerdict>;

/**
 * Run one production structured reviewer attempt.
 *
 * @param candidate - authenticated reviewer and model-specific prompt
 *
 * @param signal - optional tool cancellation signal
 *
 * @returns strict reviewer verdict
 *
 * @mutates signal - shared attempt cancellation may retain caller signal
 *
 * @example
 * ```ts
 * await runGoalReviewerAttempt({ candidate });
 * ```
 */
async function runGoalReviewerAttempt(
  {
    candidate,
    signal,
  }: Parameters<GoalReviewerAttempt>[0],
): Promise<GoalReviewVerdict> {
  return await runStructuredReviewAttempt({
    model: candidate.model,
    auth: candidate.auth,
    prompt: {
      systemPrompt: candidate.systemPrompt,
      userContent: candidate.userContent,
    },
    contract: GOAL_REVIEW_CONTRACT,
    timeoutMs: REVIEW_TIMEOUT_MS,
    maxOutputTokens: REVIEW_OUTPUT_TOKENS,
    ...(signal === undefined ? {} : { signal, }),
  },);
}

/**
 * Run initial reviewer and distinct bounded availability fallbacks from one pool.
 *
 * @param pool - expected-cost-ranked authenticated candidates
 *
 * @param signal - optional tool cancellation signal
 *
 * @param attempt - complete candidate attempt capability
 *
 * @returns first valid verdict with winning reviewer audit
 *
 * @mutates signal - candidate attempt may retain caller cancellation signal
 *
 * @mutates attempt - injected attempt may change captured deterministic test state
 *
 * @throws {@link ReviewUnavailableError} when pool is empty or every attempt fails
 *
 * @example
 * ```ts
 * await runGoalReviewerPool({ pool });
 * ```
 */
async function runGoalReviewerPool(
  {
    pool,
    signal,
    attempt = runGoalReviewerAttempt,
  }: {
    readonly pool: GoalReviewerPool;
    readonly signal?: AbortSignal;
    readonly attempt?: ForeignBorrowed<GoalReviewerAttempt>;
  },
): Promise<GoalCompletionReview> {
  /**
   * Ranked candidates and selection diagnostics.
   */
  const {
    candidates,
    diagnostics,
  } = pool;
  /**
   * Initial highest-cost reviewer.
   */
  const [firstCandidate,] = candidates;
  if (firstCandidate === undefined) {
    throw new ReviewUnavailableError({
      attemptedCandidateIdentities: [],
      diagnostics: diagnostics.length === 0
        ? ['No distinct authenticated reviewer is eligible.',]
        : diagnostics,
    },);
  }
  reviewRunnerLogger.debug(
    `selected initial goal reviewer ${canonicalSlug(firstCandidate.model,)} from ${candidates.length} authenticated candidates`,
  );
  /**
   * Shared availability-fallback result.
   */
  const result = await runReviewWithFallback<GoalReviewerCandidate, GoalReviewVerdict>({
    firstCandidate,
    candidateIdentity(candidate,) {
      return canonicalSlug(candidate.model,);
    },
    // oxlint-disable-next-line typescript/require-await -- Shared fallback resolver callback requires Promise while finite-pool selection is synchronous.
    async resolveFallback({ excludedCandidateIdentities, },) {
      /**
       * Highest-ranked candidate outside every prior and primary exclusion.
       */
      const candidate = candidates.find(function isNotExcluded(candidateToCheck,) {
        return !excludedCandidateIdentities.includes(canonicalSlug(candidateToCheck.model,),);
      },);
      if (candidate === undefined)
        throw new NoEligibleGoalReviewerError();
      return candidate;
    },
    async runAttempt({ candidate, },) {
      return await attempt({
        candidate,
        ...(signal === undefined ? {} : { signal, }),
      },);
    },
    isCandidateUnavailable(error,) {
      return error instanceof NoEligibleGoalReviewerError;
    },
  },);
  /**
   * Winning reviewer candidate metadata.
   */
  const { candidate: winner, } = result;
  return {
    verdict: result.verdict,
    reviewerIdentity: result.candidateIdentity,
    attemptedReviewerIdentities: result.attemptedCandidateIdentities,
    transcriptTruncated: winner.transcriptTruncated,
  };
}

/**
 * Production completion reviewer building active-branch evidence and scoped pool.
 *
 * @param request - locally validated active completion claim
 *
 * @param context - current Pi tool context
 *
 * @param signal - tool cancellation signal
 *
 * @returns first valid verdict and reviewer audit
 *
 * @mutates context - context.sessionManager.getBranch, scope resolution, and auth may change Pi-owned state
 *
 * @mutates signal - shared attempt cancellation may retain caller signal
 *
 * @throws {@link ReviewUnavailableError} when every eligible attempt fails
 *
 * @example
 * ```ts
 * await reviewGoalCompletion({ request, context });
 * ```
 */
async function reviewGoalCompletion(
  {
    request,
    context,
    signal,
  }: Parameters<GoalCompletionReviewer>[0],
): Promise<GoalCompletionReview> {
  /**
   * Selected active branch captured before reviewer awaits.
   */
  const branch = context.sessionManager
    .getBranch();
  /**
   * Post-start evidence excluding pending completion assistant message.
   */
  const evidence = buildGoalReviewEvidence({
    branch,
    request,
  },);
  /**
   * Ranked authenticated reviewer pool.
   */
  const pool = await resolveGoalReviewerPool({
    context,
    evidence,
  },);
  return await runGoalReviewerPool({
    pool,
    ...(signal === undefined ? {} : { signal, }),
  },);
}

export {
  reviewGoalCompletion,
  runGoalReviewerAttempt,
  runGoalReviewerPool,
};
export type { GoalReviewerAttempt, };
