/**
 * Local `goal_complete` validation before secondary-review spending.
 *
 * @module
 */

import type {
  GoalControllerState,
  GoalRuntimeEpoch,
} from './types.ts';
import type { ValidGoalCompletionRequest, } from './completion-types.ts';

/**
 * Explicit incomplete-state phrases rejected without model review.
 */
const CONTRADICTORY_SUMMARY_PHRASES = [
  'not complete',
  'not done',
  'not finished',
  'still incomplete',
  'tests still fail',
  'tests failing',
] as const;

/**
 * Accepted request or direct local diagnostic.
 */
type GoalCompletionPreflightResult =
  | {
    readonly accepted: true;
    readonly request: ValidGoalCompletionRequest;
  }
  | {
    readonly accepted: false;
    readonly diagnostic: string;
  };

/**
 * Detect explicit bounded phrase contradictions without regular expressions.
 *
 * @param summary - normalized model-submitted completion summary
 *
 * @returns whether summary plainly states work remains incomplete
 *
 * @example
 * ```ts
 * summaryContradictsCompletion('Tests still fail.');
 * ```
 */
function summaryContradictsCompletion(summary: string,): boolean {
  /**
   * Case-folded summary scanned once per fixed phrase.
   */
  const normalized = summary.toLocaleLowerCase('en-US',);
  return CONTRADICTORY_SUMMARY_PHRASES.some(function containsContradiction(phrase,) {
    return normalized.includes(phrase,);
  },);
}

/**
 * Validate goal completion request and capture stale-result identity.
 *
 * @param controller - current live goal controller
 *
 * @param runtimeEpoch - current runtime identity
 *
 * @param branchLeafId - current selected branch leaf
 *
 * @param toolCallId - current completion call identity
 *
 * @param goalId - submitted generation guard
 *
 * @param summary - submitted completion evidence summary
 *
 * @param isFinalToolCall - whether no later sibling tool call exists
 *
 * @returns accepted normalized request or direct diagnostic
 *
 * @example
 * ```ts
 * preflightGoalCompletion({ controller, runtimeEpoch, branchLeafId, toolCallId, goalId, summary, isFinalToolCall: true });
 * ```
 */
function preflightGoalCompletion(
  {
    controller,
    runtimeEpoch,
    branchLeafId,
    toolCallId,
    goalId,
    summary,
    isFinalToolCall,
  }: {
    readonly controller: GoalControllerState;
    readonly runtimeEpoch: GoalRuntimeEpoch;
    readonly branchLeafId: string;
    readonly toolCallId: string;
    readonly goalId: string;
    readonly summary: string;
    readonly isFinalToolCall: boolean;
  },
): GoalCompletionPreflightResult {
  if (controller.goal
    .phase
    !== 'active') {
    return {
      accepted: false,
      diagnostic: 'No active goal can be completed.',
    };
  }
  /**
   * Normalized generation guard.
   */
  const normalizedGoalId = goalId.trim();
  if (normalizedGoalId === '') {
    return {
      accepted: false,
      diagnostic: 'goal_id must be non-empty and match the current active goal_id.',
    };
  }
  /**
   * Normalized completion summary.
   */
  const normalizedSummary = summary.trim();
  if (normalizedSummary === '') {
    return {
      accepted: false,
      diagnostic: 'summary must be non-empty and describe completed work and verification.',
    };
  }
  if (normalizedGoalId
    !== controller.goal
    .generationId) {
    return {
      accepted: false,
      diagnostic: 'Stale goal_complete request: goal_id does not match the current active goal.',
    };
  }
  if (!isFinalToolCall) {
    return {
      accepted: false,
      diagnostic: 'goal_complete must be the final tool call in the assistant message. Finish every remaining action, then submit completion as the final call.',
    };
  }
  if (summaryContradictsCompletion(normalizedSummary,)) {
    return {
      accepted: false,
      diagnostic: 'Completion summary explicitly reports unfinished or failing work. Resolve it before calling goal_complete.',
    };
  }
  return {
    accepted: true,
    request: {
      goal: controller.goal,
      goalId: normalizedGoalId,
      summary: normalizedSummary,
      runtimeEpoch,
      branchLeafId,
      toolCallId,
    },
  };
}

export {
  preflightGoalCompletion,
  summaryContradictsCompletion,
};
export type { GoalCompletionPreflightResult, };
