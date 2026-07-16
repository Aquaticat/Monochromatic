/**
 * Pi registration boundary for goal completion tool and sibling finality tracking.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { Type, } from 'typebox';

import {
  executeGoalCompletion,
  type GoalCompletionParams,
  type GoalReviewerUnavailableHandler,
} from './completion.ts';
import { goalCompletionFinalityFromMessage, } from './completion-finality.ts';
import type { GoalCompletionReviewer, } from './completion-types.ts';
import { GOAL_COMPLETE_TOOL_NAME, } from './constants.ts';
import {
  defaultNow,
  type GoalLifecycleHandle,
} from './lifecycle.ts';
import { reviewGoalCompletion, } from './review-runner.ts';
import { createGoalReviewerUnavailableHandler, } from './review-unavailable.ts';

/**
 * Finalized message event shape omitted from Pi root type exports.
 */
type GoalMessageEndEvent = {
  readonly type: 'message_end';
  readonly message: SessionMessageEntry['message'];
};

/**
 * Registration dependencies for completion tool.
 */
type GoalCompletionRegistration = {
  readonly pi: ForeignBorrowed<ExtensionAPI>;
  readonly lifecycle: GoalLifecycleHandle;
  readonly reviewer?: GoalCompletionReviewer;
  readonly handleReviewerUnavailable?: GoalReviewerUnavailableHandler;
  readonly now?: () => string;
};

/**
 * Register sequential completion tool and message-finality tracker.
 *
 * @param pi - Pi extension API receiving tool and lifecycle registration
 *
 * @param lifecycle - shared goal runtime boundary
 *
 * @param reviewer - injectable independent model reviewer
 *
 * @param handleReviewerUnavailable - mode-specific reviewer exhaustion behavior
 *
 * @param now - timestamp source
 *
 * @mutates pi - registers message handler and sequential completion tool
 *
 * @example
 * ```ts
 * registerGoalCompletion({ pi, lifecycle });
 * ```
 */
function registerGoalCompletion(
  {
    pi,
    lifecycle,
    reviewer = reviewGoalCompletion,
    handleReviewerUnavailable,
    now = defaultNow,
  }: GoalCompletionRegistration,
): void {
  /**
   * Final-tool status keyed by finalized assistant tool-call identity.
   */
  const finality = new Map<string, boolean>();
  /**
   * Explicit caller override or production mode-specific exhaustion handler.
   */
  const unavailableHandler = handleReviewerUnavailable
    ?? createGoalReviewerUnavailableHandler({
      lifecycle,
      now,
    },);
  pi.on(
    'message_end',
    function captureCompletionFinality(event: ForeignBorrowed<GoalMessageEndEvent>,) {
      for (const record of goalCompletionFinalityFromMessage(event.message,)) {
        finality.set(
          record.toolCallId,
          record.isFinalToolCall,
        );
      }
    },
  );
  pi.registerTool({
    name: GOAL_COMPLETE_TOOL_NAME,
    label: 'Complete Goal',
    description: 'Request independent completion review for exact active goal generation. Call only as final action after requirement-by-requirement verification.',
    promptSnippet: 'Request independent completion review for active /goal after all work and verification finish',
    promptGuidelines: [
      'Call goal_complete only as the final tool call after every objective requirement is complete and verified.',
      'Pass exact current goal_id from active goal prompt. It is only a stale-completion guard.',
      'Summarize completed work and concrete verification evidence.',
    ],
    executionMode: 'sequential',
    parameters: Type.Object(
      {
        goal_id: Type.String({
          description: 'Exact current goal_id from active goal prompt.',
        },),
        summary: Type.String({
          description: 'Completed work and requirement-by-requirement verification evidence.',
        },),
      },
      {
        additionalProperties: false,
      },
    ),
    async execute(
      toolCallId,
      params: Readonly<GoalCompletionParams>,
      signal,
      _onUpdate,
      context: ForeignBorrowed<ExtensionContext>,
    ) {
      return await executeGoalCompletion({
        toolCallId,
        params,
        ...(signal === undefined ? {} : { signal, }),
        context,
        finality,
        lifecycle,
        reviewer,
        handleReviewerUnavailable: unavailableHandler,
        now,
      },);
    },
  },);
}

export { registerGoalCompletion, };
export type { GoalCompletionRegistration, };
