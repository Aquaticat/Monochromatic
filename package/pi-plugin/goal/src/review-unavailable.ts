/**
 * TUI manual and non-interactive terminal fallbacks after reviewer exhaustion.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { ReviewUnavailableError, } from '@monochromatic-dev/pi-shared-model-review/ts';

import {
  completionResult,
  revalidateCompletion,
  type GoalReviewerUnavailableHandler,
} from './completion.ts';
import {
  manuallyApproveGoalCompletion,
  markGoalReviewUnavailable,
} from './completion-terminal.ts';
import type { GoalCompletionResult, } from './completion-types.ts';
import {
  defaultNow,
  type GoalLifecycleHandle,
} from './lifecycle.ts';
import {
  type ManualGoalReviewPrompt,
  promptManualGoalReview,
} from './manual-review-dialog.ts';

/**
 * Normalized model-review exhaustion audit.
 */
type GoalReviewFailureAudit = {
  readonly attemptedReviewerIdentities: readonly string[];
  readonly diagnostics: readonly string[];
  readonly diagnostic: string;
};

/**
 * Convert arbitrary exhausted-review error to stable audit fields.
 *
 * @param error - model selection, auth, transport, timeout, or parser failure
 *
 * @returns attempted identities and normalized diagnostics
 *
 * @example
 * ```ts
 * normalizeGoalReviewFailure(error);
 * ```
 */
function normalizeGoalReviewFailure(error: unknown,): GoalReviewFailureAudit {
  if (error instanceof ReviewUnavailableError) {
    /**
     * Shared normalized diagnostics with non-empty fallback.
     */
    const diagnostics = error.diagnostics
      .length
      === 0
      ? [error.message,]
      : error.diagnostics;
    return {
      attemptedReviewerIdentities: error.attemptedCandidateIdentities,
      diagnostics,
      diagnostic: diagnostics.join('; ',),
    };
  }
  /**
   * Normalized unexpected reviewer orchestration failure.
   */
  const diagnostic = caughtValueText(error,);
  return {
    attemptedReviewerIdentities: [],
    diagnostics: [diagnostic,],
    diagnostic,
  };
}

/**
 * Build explicit stale-completion result without state mutation.
 *
 * @returns stale tool result
 *
 * @example
 * ```ts
 * staleFallbackResult();
 * ```
 */
function staleFallbackResult(): GoalCompletionResult {
  return completionResult({
    text: 'Stale goal_complete fallback ignored because the active goal, generation, runtime, or branch changed.',
    details: { outcome: 'stale', },
  },);
}

/**
 * Create mode-specific reviewer exhaustion handler bound to current lifecycle.
 *
 * @param lifecycle - live goal runtime used for stale revalidation and transitions
 *
 * @param promptManualReview - injectable mandatory TUI decision dialog
 *
 * @param now - timestamp source
 *
 * @returns reviewer-unavailable handler for completion registration
 *
 * @mutates promptManualReview - dialog capability may update captured TUI state
 *
 * @example
 * ```ts
 * const handler = createGoalReviewerUnavailableHandler({ lifecycle });
 * ```
 */
function createGoalReviewerUnavailableHandler(
  {
    lifecycle,
    promptManualReview = promptManualGoalReview,
    now = defaultNow,
  }: {
    readonly lifecycle: GoalLifecycleHandle;
    readonly promptManualReview?: ForeignBorrowed<ManualGoalReviewPrompt>;
    readonly now?: () => string;
  },
): GoalReviewerUnavailableHandler {
  return async function handleGoalReviewerUnavailable(
    {
      error,
      request,
      context,
    },
  ) {
    /**
     * Normalized failed model-review audit.
     */
    const audit = normalizeGoalReviewFailure(error,);
    /**
     * Stale check before any mode-specific UI or terminal transition.
     */
    const initialRevalidation = revalidateCompletion({
      lifecycle,
      request,
      context,
    },);
    if (!initialRevalidation.current)
      return staleFallbackResult();
    if (context.mode !== 'tui') {
      lifecycle.applyTransition({
        transition: markGoalReviewUnavailable({
          controller: initialRevalidation.controller,
          request,
          attemptedReviewerIdentities: audit.attemptedReviewerIdentities,
          diagnostic: audit.diagnostic,
          timestamp: now(),
        },),
        context,
      },);
      return completionResult({
        text: `Independent completion review unavailable: ${audit.diagnostic}`,
        details: {
          outcome: 'review_unavailable',
          attemptedReviewerIdentities: audit.attemptedReviewerIdentities,
          reviewerFeedback: audit.diagnostic,
        },
        terminate: true,
      },);
    }
    /**
     * Mandatory explicit TUI decision after model exhaustion.
     */
    const decision = await promptManualReview({
      context,
      diagnostic: audit.diagnostic,
    },);
    /**
     * Post-dialog stale check before state mutation or rejection feedback.
     */
    const finalRevalidation = revalidateCompletion({
      lifecycle,
      request,
      context,
    },);
    if (!finalRevalidation.current)
      return staleFallbackResult();
    if (decision.action === 'accept') {
      lifecycle.applyTransition({
        transition: manuallyApproveGoalCompletion({
          controller: finalRevalidation.controller,
          request,
          diagnostic: audit.diagnostic,
          timestamp: now(),
        },),
        context,
      },);
      return completionResult({
        text: `Goal manually approved after independent reviewers were unavailable: ${audit.diagnostic}`,
        details: {
          outcome: 'approved',
          reviewerFeedback: audit.diagnostic,
          attemptedReviewerIdentities: audit.attemptedReviewerIdentities,
        },
        terminate: true,
      },);
    }
    /**
     * Optional rejection reason normalized without replacing empty rejection semantics.
     */
    const reason = decision.reason
      .trim();
    return completionResult({
      text: reason === ''
        ? 'Manual reviewer rejected completion after model review was unavailable.'
        : reason,
      details: {
        outcome: 'denied',
        ...(reason === '' ? {} : { reviewerFeedback: reason, }),
        attemptedReviewerIdentities: audit.attemptedReviewerIdentities,
      },
    },);
  };
}

export {
  createGoalReviewerUnavailableHandler,
  normalizeGoalReviewFailure,
  staleFallbackResult,
};
export type { GoalReviewFailureAudit, };
