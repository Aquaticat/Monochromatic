/**
 * Assistant-message sibling ordering for `goal_complete` preflight.
 *
 * @module
 */

import type { SessionMessageEntry, } from '@earendil-works/pi-coding-agent';

import { GOAL_COMPLETE_TOOL_NAME, } from './constants.ts';

/**
 * Completion call identity paired with final-tool status.
 */
type GoalCompletionFinality = {
  readonly toolCallId: string;
  readonly isFinalToolCall: boolean;
};

/**
 * Find goal completion calls and whether each is message's final tool call.
 *
 * @param message - finalized assistant or non-assistant message
 *
 * @returns goal completion call finality records
 *
 * @example
 * ```ts
 * goalCompletionFinalityFromMessage(assistantMessage);
 * ```
 */
function goalCompletionFinalityFromMessage(
  message: Readonly<SessionMessageEntry['message']>,
): readonly GoalCompletionFinality[] {
  if (message.role !== 'assistant')
    return [];
  /**
   * Tool calls in source order.
   */
  const toolCalls = message.content
    .filter(function isToolCall(content,) {
    return content.type === 'toolCall';
  },);
  /**
   * Final tool call when message contains any.
   */
  const finalToolCall = toolCalls.at(-1,);
  return toolCalls
    .filter(function isGoalCompletionCall(toolCall,) {
      return toolCall.name === GOAL_COMPLETE_TOOL_NAME;
    },)
    .map(function recordFinality(toolCall,) {
      return {
        toolCallId: toolCall.id,
        isFinalToolCall: finalToolCall?.id === toolCall.id,
      };
    },);
}

export { goalCompletionFinalityFromMessage, };
export type { GoalCompletionFinality, };
