/**
 * Goal completion result revalidation and persisted state transitions.
 *
 * @module
 */

import { reduceGoalEvent, } from './reducer.ts';
import type { ValidGoalCompletionRequest, } from './completion-types.ts';
import type {
  GoalControllerState,
  GoalControllerTransition,
} from './types.ts';

/**
 * Revalidate controller identities before touching captured session context.
 *
 * @param controller - current live controller
 *
 * @param request - preflight capture before asynchronous work
 *
 * @returns whether captured completion still belongs to current runtime generation
 *
 * @example
 * ```ts
 * completionRequestControllerStillCurrent({ controller, request });
 * ```
 */
function completionRequestControllerStillCurrent(
  {
    controller,
    request,
  }: {
    readonly controller: GoalControllerState;
    readonly request: ValidGoalCompletionRequest;
  },
): boolean {
  if (controller.shutdown)
    return false;
  if (controller.runtimeEpoch !== request.runtimeEpoch)
    return false;
  if (controller.goal
    .phase
    !== 'active')
    return false;
  if (controller.goal
    .runId
    !== request.goal
    .runId)
    return false;
  return controller.goal
    .generationId
    === request.goal
    .generationId;
}

/**
 * Revalidate controller and selected branch after asynchronous work.
 *
 * @param controller - current live controller
 *
 * @param request - preflight capture before asynchronous work
 *
 * @param branchLeafId - current selected branch leaf
 *
 * @returns whether captured completion still belongs to current generation
 *
 * @example
 * ```ts
 * completionRequestStillCurrent({ controller, request, branchLeafId });
 * ```
 */
function completionRequestStillCurrent(
  {
    controller,
    request,
    branchLeafId,
  }: {
    readonly controller: GoalControllerState;
    readonly request: ValidGoalCompletionRequest;
    readonly branchLeafId: string;
  },
): boolean {
  return completionRequestControllerStillCurrent({
    controller,
    request,
  },) && (branchLeafId === request.branchLeafId);
}

/**
 * Persist valid reviewer denial while retaining active goal.
 *
 * @param controller - current revalidated controller
 *
 * @param request - normalized completion claim
 *
 * @param feedback - valid reviewer feedback
 *
 * @param timestamp - ISO denial timestamp
 *
 * @returns active denial transition without termination
 *
 * @example
 * ```ts
 * denyGoalCompletion({ controller, request, feedback: 'Run tests.', timestamp });
 * ```
 */
function denyGoalCompletion(
  {
    controller,
    request,
    feedback,
    timestamp,
  }: {
    readonly controller: GoalControllerState;
    readonly request: ValidGoalCompletionRequest;
    readonly feedback: string;
    readonly timestamp: string;
  },
): GoalControllerTransition {
  if (controller.goal
    .phase
    !== 'active')
    throw new Error('Cannot deny completion for non-active goal',);
  /**
   * Persisted model-denial event.
   */
  const event = {
    kind: 'review_denied',
    runId: request.goal
      .runId,
    generationId: request.goal
      .generationId,
    feedback,
    continuationSequence: controller.goal
      .continuationSequence,
    transitionedAt: timestamp,
  } as const;
  /**
   * Active state retaining reviewer feedback.
   */
  const goal = reduceGoalEvent({
    state: controller.goal,
    event,
  },);
  return {
    controller: {
      goal,
      runtimeEpoch: controller.runtimeEpoch,
      settlementSequence: controller.settlementSequence,
      shutdown: controller.shutdown,
    },
    effects: [
      {
        type: 'persist',
        event,
      },
      {
        type: 'log',
        level: 'debug',
        message: `goal reviewer denied completion for ${request.goal
          .runId}`,
      },
    ],
  };
}

/**
 * Persist valid model approval as terminal completion.
 *
 * @param controller - current revalidated controller
 *
 * @param request - normalized completion claim
 *
 * @param reviewerIdentity - approving distinct reviewer
 *
 * @param feedback - reviewer approval rationale
 *
 * @param timestamp - ISO completion timestamp
 *
 * @returns terminal model-approved transition
 *
 * @example
 * ```ts
 * approveGoalCompletion({ controller, request, reviewerIdentity, feedback, timestamp });
 * ```
 */
function approveGoalCompletion(
  {
    controller,
    request,
    reviewerIdentity,
    feedback,
    timestamp,
  }: {
    readonly controller: GoalControllerState;
    readonly request: ValidGoalCompletionRequest;
    readonly reviewerIdentity: string;
    readonly feedback: string;
    readonly timestamp: string;
  },
): GoalControllerTransition {
  if (controller.goal
    .phase
    !== 'active')
    throw new Error('Cannot approve completion for non-active goal',);
  /**
   * Persisted model-approved terminal event.
   */
  const event = {
    kind: 'run_completed_model',
    runId: request.goal
      .runId,
    generationId: request.goal
      .generationId,
    summary: request.summary,
    reviewerIdentity,
    reviewerFeedback: feedback,
    completedAt: timestamp,
  } as const;
  /**
   * Terminal state derived through branch reducer.
   */
  const goal = reduceGoalEvent({
    state: controller.goal,
    event,
  },);
  return {
    controller: {
      goal,
      runtimeEpoch: controller.runtimeEpoch,
      settlementSequence: controller.settlementSequence,
      shutdown: controller.shutdown,
    },
    effects: [
      {
        type: 'persist',
        event,
      },
      { type: 'clear_footer', },
      {
        type: 'log',
        level: 'debug',
        message: `goal completion approved by ${reviewerIdentity} for ${request.goal
          .runId}`,
      },
    ],
  };
}

export {
  approveGoalCompletion,
  completionRequestControllerStillCurrent,
  completionRequestStillCurrent,
  denyGoalCompletion,
};
