/**
 * Goal reviewer transport orchestration over ranked authenticated pool.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
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
  resolveGoalReviewerPool,
} from './review-selection.ts';

/**
 * Reviewer orchestration logger.
 */
const reviewRunnerLogger = tagged({ tag: 'pi-goal-review-runner', },);

/**
 * Production completion reviewer using shared structured transport and fallbacks.
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
    resolveFallback({ excludedCandidateIdentities, },) {
      /**
       * Highest-ranked candidate outside every prior and primary exclusion.
       */
      const candidate = candidates.find(function isNotExcluded(candidateToCheck,) {
        return !excludedCandidateIdentities.includes(canonicalSlug(candidateToCheck.model,),);
      },);
      if (candidate === undefined)
        return Promise.reject(new NoEligibleGoalReviewerError(),);
      return Promise.resolve(candidate,);
    },
    async runAttempt({ candidate, },) {
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

export { reviewGoalCompletion, };
