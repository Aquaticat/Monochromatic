/**
 * Default noninteractive completion exhaustion runtime scenario.
 *
 * @module
 */

import {
  activeGoalGeneration,
  emitGoalEvent,
  getGoalCompletionTool,
  requireCondition,
} from './pi-runtime-verifier-access.ts';
import type { GoalRuntimeHarness, } from './pi-runtime-verifier-harness.ts';

/**
 * Verify discovered default completion terminates when reviewers are unavailable.
 *
 * @param harness - real-loader harness positioned on active replacement branch
 *
 * @returns completion scenario summary
 *
 * @throws when terminal outcome, persistence, or footer differs
 *
 * @example
 * ```ts
 * await verifyDefaultCompletionExhaustion(harness);
 * ```
 */
async function verifyDefaultCompletionExhaustion(
  harness: GoalRuntimeHarness,
): Promise<string> {
  /**
   * Final completion tool-call identity tracked by message-end handler.
   */
  const completionCallId = 'runtime-completion-call';
  await emitGoalEvent({
    harness,
    type: 'message_end',
    event: {
      type: 'message_end',
      message: {
        role: 'assistant',
        content: [{
          type: 'toolCall',
          id: completionCallId,
          name: 'goal_complete',
          arguments: {},
        },],
      },
    },
  },);
  /**
   * Completion generation reconstructed from selected replacement branch.
   */
  const generationId = activeGoalGeneration(harness.sessionManager,);
  /**
   * Default registered completion result after reviewer selection exhaustion.
   */
  const completion = await getGoalCompletionTool(harness,)({
    toolCallId: completionCallId,
    params: {
      goal_id: generationId,
      summary: 'Disposable runtime verification completed.',
    },
    context: harness.context,
  },);
  requireCondition({
    condition: completion.terminate === true,
    message: 'noninteractive reviewer exhaustion did not terminate',
  },);
  requireCondition({
    condition: completion.details
      .outcome
      === 'review_unavailable',
    message: 'reviewer exhaustion returned wrong outcome',
  },);
  requireCondition({
    condition: harness.statuses
      .at(-1,)
      === 'CLEARED',
    message: 'terminal reviewer exhaustion did not clear footer',
  },);
  return 'noninteractive reviewer exhaustion';
}

export { verifyDefaultCompletionExhaustion, };
