/**
 * Harness-owned settlement-review registration.
 *
 * @module
 */

import type {
  AgentEndEvent,
  AgentSettledEvent,
  ExtensionAPI,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { registerBackgroundProcessMonitor, } from './background-process-monitor.ts';
import {
  createGoalSettlementReviewRequest,
  executeGoalSettlementReview,
  type GoalReviewerUnavailableHandler,
} from './completion.ts';
import type { GoalSettlementReviewer, } from './completion-types.ts';
import {
  defaultCreateId,
  defaultNow,
  type GoalLifecycleHandle,
} from './lifecycle-services.ts';
import { reviewGoalSettlement, } from './review-runner.ts';
import { createGoalReviewerUnavailableHandler, } from './review-unavailable.ts';

/**
 * Registration dependencies for private settlement review.
 */
type GoalSettlementReviewRegistration = {
  readonly pi: ForeignBorrowed<ExtensionAPI>;
  readonly lifecycle: GoalLifecycleHandle;
  readonly reviewer?: GoalSettlementReviewer;
  readonly handleReviewerUnavailable?: GoalReviewerUnavailableHandler;
  readonly createId?: () => string;
  readonly now?: () => string;
};

/**
 * Build stable duplicate-review key from captured settlement.
 *
 * @param request - captured active settlement
 *
 * @returns runtime-local duplicate guard key
 *
 * @example
 * ```ts
 * settlementReviewKey(request);
 * ```
 */
function settlementReviewKey(
  request: Parameters<typeof executeGoalSettlementReview>[0]['request'],
): string {
  return JSON.stringify([
    request.runtimeEpoch,
    request.goal.runId,
    request.goal.generationId,
    request.branchLeafId,
    request.settlementSequence,
  ],);
}

/**
 * Register private review at Pi's final settlement seam.
 *
 * @param pi - Pi extension API receiving lifecycle handlers
 *
 * @param lifecycle - shared goal runtime
 *
 * @param reviewer - injectable independent reviewer
 *
 * @param handleReviewerUnavailable - injectable mode-specific fallback
 *
 * @param createId - private continuation identity source
 *
 * @param now - timestamp source
 *
 * @mutates pi - registers agent lifecycle handlers
 *
 * @example
 * ```ts
 * registerGoalSettlementReview({ pi, lifecycle });
 * ```
 */
function registerGoalSettlementReview(
  {
    pi,
    lifecycle,
    reviewer = reviewGoalSettlement,
    handleReviewerUnavailable,
    createId = defaultCreateId,
    now = defaultNow,
  }: GoalSettlementReviewRegistration,
): void {
  /** Passive runtime-local view of background work. */
  const backgroundProcessMonitor = registerBackgroundProcessMonitor(pi,);
  /** Explicit user abort marker consumed by final settlement. */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Separate agent_end and agent_settled callbacks share one runtime marker.
  let settledRunWasAborted = false;
  /** Most recent captured settlement protected from duplicate callbacks. */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- Runtime-local duplicate guard spans agent_settled callbacks.
  let lastReviewedSettlementKey: string | undefined;
  /** Explicit fallback or production mode-specific exhaustion handler. */
  const unavailableHandler = handleReviewerUnavailable
    ?? createGoalReviewerUnavailableHandler({
      lifecycle,
      createId,
      now,
    },);

  pi.on(
    'agent_end',
    function recordAbortedRun(
      event: ForeignBorrowed<AgentEndEvent>,
    ) {
      /** Latest assistant message determines explicit abort. */
      const finalAssistant = event.messages
        .findLast(function isAssistant(message,) {
          return message.role === 'assistant';
        },);
      settledRunWasAborted = finalAssistant?.stopReason === 'aborted';
    },
  );
  pi.on(
    'agent_settled',
    async function reviewSettledGoal(
      _event: ForeignBorrowed<AgentSettledEvent>,
      context: ForeignBorrowed<ExtensionContext>,
    ) {
      if (settledRunWasAborted) {
        settledRunWasAborted = false;
        return;
      }
      if ((!context.isIdle())
        || context.hasPendingMessages()
        || backgroundProcessMonitor.hasLiveBackgroundProcess()) {
        return;
      }
      if (lifecycle.deliverPendingKickoff(context,))
        return;
      /** Finalized selected branch leaf. */
      const branchLeafId = context.sessionManager.getLeafId();
      if (branchLeafId === null)
        return;
      /** Captured active settlement or absent marker. */
      const request = createGoalSettlementReviewRequest({
        controller: lifecycle.currentController(),
        branchLeafId,
      },);
      if (request === undefined)
        return;
      /** Duplicate guard for exact runtime, generation, leaf, and sequence. */
      const reviewKey = settlementReviewKey(request,);
      if (reviewKey === lastReviewedSettlementKey)
        return;
      lastReviewedSettlementKey = reviewKey;
      await executeGoalSettlementReview({
        request,
        context,
        lifecycle,
        reviewer,
        handleReviewerUnavailable: unavailableHandler,
        createId,
        now,
      },);
    },
  );
}

export {
  registerGoalSettlementReview,
  settlementReviewKey,
};
export type { GoalSettlementReviewRegistration, };
