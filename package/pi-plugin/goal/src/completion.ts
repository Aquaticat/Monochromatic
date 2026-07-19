/**
 * `goal_complete` tool registration and independent model-review outcomes.
 *
 * @module
 */

import type { ExtensionContext, } from '@earendil-works/pi-coding-agent';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { ReviewUnavailableError, } from '@monochromatic-dev/pi-shared-model-review/ts';
import {
  approveGoalCompletion,
  completionRequestControllerStillCurrent,
  completionRequestStillCurrent,
  denyGoalCompletion,
} from './completion-outcome.ts';
import { preflightGoalCompletion, } from './completion-preflight.ts';
import type {
  GoalCompletionReview,
  GoalCompletionResult,
  GoalCompletionReviewer,
  ValidGoalCompletionRequest,
} from './completion-types.ts';
import type { GoalLifecycleHandle, } from './lifecycle-services.ts';

/**
 * Tool arguments submitted by primary model.
 */
type GoalCompletionParams = {
  readonly goal_id: string;
  readonly summary: string;
};

/**
 * Mode-specific reviewer-exhaustion capability added by fallback layer.
 */
type GoalReviewerUnavailableHandler = (
  input: {
    readonly error: unknown;
    readonly request: ValidGoalCompletionRequest;
    readonly context: ForeignBorrowed<ExtensionContext>;
  },
) => Promise<GoalCompletionResult>;

/**
 * Available model review or mode-specific exhaustion result.
 */
type GoalReviewAcquisition =
  | {
    readonly available: true;
    readonly result: GoalCompletionReview;
  }
  | {
    readonly available: false;
    readonly result: GoalCompletionResult;
  };

/**
 * Build text-only completion tool result.
 *
 * @param text - model-visible result text
 *
 * @param details - structured audit details
 *
 * @param terminate - optional early-termination hint
 *
 * @returns Pi goal completion result
 *
 * @example
 * ```ts
 * completionResult({ text: 'Approved.', details: { outcome: 'approved' }, terminate: true });
 * ```
 */
function completionResult(
  {
    text,
    details,
    terminate,
  }: {
    readonly text: string;
    readonly details: GoalCompletionResult['details'];
    readonly terminate?: boolean;
  },
): GoalCompletionResult {
  return {
    content: [{
      type: 'text',
      text,
    },],
    details,
    ...(terminate === undefined ? {} : { terminate, }),
  };
}

/**
 * Report reviewer exhaustion while fallback layer is not installed.
 *
 * @param error - exhausted reviewer diagnostic
 *
 * @returns non-terminal model-visible failure
 *
 * @example
 * ```ts
 * await defaultUnavailableHandler({ error, request, context });
 * ```
 */
function defaultUnavailableHandler(
  {
    error,
  }: {
    readonly error: unknown;
    readonly request: ValidGoalCompletionRequest;
    readonly context: ForeignBorrowed<ExtensionContext>;
  },
): Promise<GoalCompletionResult> {
  return Promise.resolve(completionResult({
    text: `Independent completion review is unavailable: ${caughtValueText(error,)}`,
    details: {
      outcome: 'review_unavailable',
      ...(error instanceof ReviewUnavailableError
        ? { attemptedReviewerIdentities: error.attemptedCandidateIdentities, }
        : {}),
    },
  },),);
}

/**
 * Revalidate async completion request without touching replaced session context.
 *
 * @param lifecycle - current runtime controller boundary
 *
 * @param request - captured preflight identity
 *
 * @param context - original tool context used only after controller match
 *
 * @returns current controller and selected leaf, or stale marker
 *
 * @mutates context - context.sessionManager.getLeafId may change context-owned Pi state
 *
 * @example
 * ```ts
 * revalidateCompletion({ lifecycle, request, context });
 * ```
 */
function revalidateCompletion(
  {
    lifecycle,
    request,
    context,
  }: {
    readonly lifecycle: GoalLifecycleHandle;
    readonly request: ValidGoalCompletionRequest;
    readonly context: ForeignBorrowed<ExtensionContext>;
  },
):
  | {
    readonly current: true;
    readonly controller: ReturnType<GoalLifecycleHandle['currentController']>;
  }
  | { readonly current: false; } {
  /**
   * Current controller read before any captured session handle use.
   */
  const controller = lifecycle.currentController();
  if (!completionRequestControllerStillCurrent({
    controller,
    request,
  },))
    return { current: false, };
  /**
   * Current branch leaf read only while runtime and generation still match.
   */
  const branchLeafId = context.sessionManager
    .getLeafId();
  if (branchLeafId === null)
    return { current: false, };
  if (!completionRequestStillCurrent({
    controller,
    request,
    branchLeafId,
  },)) {
    return { current: false, };
  }
  return {
    current: true,
    controller,
  };
}

/**
 * Execute one completion request from local preflight through review outcome.
 *
 * @param toolCallId - Pi tool-call identity
 *
 * @param params - submitted generation and completion summary
 *
 * @param signal - current tool cancellation signal
 *
 * @param context - current Pi tool context
 *
 * @param finality - tracked assistant-message tool ordering
 *
 * @param lifecycle - shared controller boundary
 *
 * @param reviewer - independent model reviewer capability
 *
 * @param handleReviewerUnavailable - mode-specific exhausted-review handler
 *
 * @param now - timestamp source
 *
 * @returns model-visible completion outcome
 *
 * @mutates context - context.sessionManager.getLeafId, reviewer, and handleReviewerUnavailable may change or retain context-owned Pi state
 *
 * @mutates reviewer - reviewer capability may update captured transport state
 *
 * @mutates handleReviewerUnavailable - fallback capability may update captured UI state
 *
 * @mutates signal - reviewer transport may retain cancellation signal
 *
 * @example
 * ```ts
 * await executeGoalCompletion({ toolCallId, params, signal, context, finality, lifecycle, reviewer, handleReviewerUnavailable, now });
 * ```
 */
async function executeGoalCompletion(
  {
    toolCallId,
    params,
    signal,
    context,
    finality,
    lifecycle,
    reviewer,
    handleReviewerUnavailable,
    now,
  }: {
    readonly toolCallId: string;
    readonly params: GoalCompletionParams;
    readonly signal?: AbortSignal;
    readonly context: ForeignBorrowed<ExtensionContext>;
    readonly finality: ReadonlyMap<string, boolean>;
    readonly lifecycle: GoalLifecycleHandle;
    readonly reviewer: ForeignBorrowed<GoalCompletionReviewer>;
    readonly handleReviewerUnavailable: ForeignBorrowed<GoalReviewerUnavailableHandler>;
    readonly now: () => string;
  },
): Promise<GoalCompletionResult> {
  /**
   * Current selected branch leaf before reviewer spending.
   */
  const branchLeafId = context.sessionManager
    .getLeafId();
  if (branchLeafId === null) {
    return completionResult({
      text: 'goal_complete cannot run without an active session branch.',
      details: { outcome: 'rejected', },
    },);
  }
  /**
   * Current controller at local preflight boundary.
   */
  const controller = lifecycle.currentController();
  /**
   * Strict local completion validation.
   */
  const preflight = preflightGoalCompletion({
    controller,
    runtimeEpoch: controller.runtimeEpoch,
    branchLeafId,
    toolCallId,
    goalId: params.goal_id,
    summary: params.summary,
    isFinalToolCall: finality.get(toolCallId,) === true,
  },);
  if (!preflight.accepted) {
    return completionResult({
      text: preflight.diagnostic,
      details: { outcome: 'rejected', },
    },);
  }
  /**
   * Valid independent verdict or mode-specific reviewer exhaustion.
   */
  const review = await (async function obtainReview(): Promise<GoalReviewAcquisition> {
    try {
      return {
        available: true as const,
        result: await reviewer({
          request: preflight.request,
          context,
          ...(signal === undefined ? {} : { signal, }),
        },),
      };
    }
    catch (error) {
      if (signal?.aborted === true) {
        return {
          available: false as const,
          result: completionResult({
            text: 'Completion review was cancelled. The active goal remains unchanged.',
            details: { outcome: 'rejected', },
          },),
        };
      }
      return {
        available: false as const,
        result: await handleReviewerUnavailable({
          error,
          request: preflight.request,
          context,
        },),
      };
    }
  })();
  if (!review.available)
    return review.result;
  /**
   * Post-review stale-result validation.
   */
  const revalidation = revalidateCompletion({
    lifecycle,
    request: preflight.request,
    context,
  },);
  if (!revalidation.current) {
    return completionResult({
      text: 'Stale goal_complete result ignored because the active goal, generation, runtime, or branch changed during review.',
      details: { outcome: 'stale', },
    },);
  }
  if (!review.result
    .verdict
    .approved) {
    lifecycle.applyTransition({
      transition: denyGoalCompletion({
        controller: revalidation.controller,
        request: preflight.request,
        feedback: review.result
          .verdict
          .feedback,
        timestamp: now(),
      },),
      context,
    },);
    return completionResult({
      text: `Independent reviewer denied completion: ${review.result
        .verdict
        .feedback}`,
      details: {
        outcome: 'denied',
        reviewerIdentity: review.result
          .reviewerIdentity,
        reviewerFeedback: review.result
          .verdict
          .feedback,
        attemptedReviewerIdentities: review.result
          .attemptedReviewerIdentities,
        transcriptTruncated: review.result
          .transcriptTruncated,
      },
    },);
  }
  lifecycle.applyTransition({
    transition: approveGoalCompletion({
      controller: revalidation.controller,
      request: preflight.request,
      reviewerIdentity: review.result
        .reviewerIdentity,
      feedback: review.result
        .verdict
        .feedback,
      timestamp: now(),
    },),
    context,
  },);
  return completionResult({
    text: `Goal completed with independent approval from ${review.result
      .reviewerIdentity}: ${review.result
        .verdict
        .feedback}`,
    details: {
      outcome: 'approved',
      reviewerIdentity: review.result
        .reviewerIdentity,
      reviewerFeedback: review.result
        .verdict
        .feedback,
      attemptedReviewerIdentities: review.result
        .attemptedReviewerIdentities,
      transcriptTruncated: review.result
        .transcriptTruncated,
    },
    terminate: true,
  },);
}

export {
  completionResult,
  defaultUnavailableHandler,
  executeGoalCompletion,
  revalidateCompletion,
};
export type {
  GoalCompletionParams,
  GoalReviewerUnavailableHandler,
};
