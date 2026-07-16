/**
 * Visible extension-authored goal kickoff and continuation messages.
 *
 * @module
 */

import { GOAL_MESSAGE_TYPE, } from './constants.ts';
import type {
  ActiveGoalState,
  GoalMessage,
  GoalMessageMarker,
} from './types.ts';

/**
 * Build model-visible goal message body.
 *
 * JSON string encoding preserves exact objective text without allowing it to break prompt delimiters.
 *
 * @param goal - exact active goal state
 *
 * @param kind - kickoff or continuation
 *
 * @param continuationSequence - auditable continuation sequence
 *
 * @returns model-visible message body
 *
 * @example
 * ```ts
 * goalMessageContent({ goal, kind: 'kickoff', continuationSequence: 0 });
 * ```
 */
function goalMessageContent(
  {
    goal,
    kind,
    continuationSequence,
  }: {
    readonly goal: ActiveGoalState;
    readonly kind: 'kickoff' | 'continuation';
    readonly continuationSequence: number;
  },
): string {
  /**
   * Message-specific opening instruction.
   */
  const opening = kind === 'kickoff'
    ? 'Begin the active goal and continue until it is fully complete.'
    : `Continue the active goal after settlement ${continuationSequence} until it is fully complete.`;
  return [
    opening,
    `Objective (exact JSON string): ${JSON.stringify(goal.objective,)}`,
    `Current goal_id: ${goal.generationId}`,
    'This goal_id is only the stale-completion guard. It is not part of the objective.',
    'Use current files, command output, tests, and external state as authority.',
    'Do not stop at a plan or partial result.',
    'Call goal_complete only after requirement-by-requirement verification and pass this exact goal_id.',
  ].join('\n',);
}

/**
 * Build visible custom goal message and audit details.
 *
 * @param goal - exact active goal state
 *
 * @param kind - kickoff or continuation
 *
 * @param continuationSequence - message sequence
 *
 * @param marker - unique generation-scoped marker
 *
 * @returns Pi custom message
 *
 * @example
 * ```ts
 * buildGoalMessage({ goal, kind: 'continuation', continuationSequence: 1, marker });
 * ```
 */
function buildGoalMessage(
  {
    goal,
    kind,
    continuationSequence,
    marker,
  }: {
    readonly goal: ActiveGoalState;
    readonly kind: 'kickoff' | 'continuation';
    readonly continuationSequence: number;
    readonly marker: GoalMessageMarker;
  },
): GoalMessage {
  return {
    customType: GOAL_MESSAGE_TYPE,
    content: goalMessageContent({
      goal,
      kind,
      continuationSequence,
    },),
    display: true,
    details: {
      runId: goal.runId,
      generationId: goal.generationId,
      continuationSequence,
      marker,
      kind,
    },
  };
}

export {
  buildGoalMessage,
  goalMessageContent,
};
