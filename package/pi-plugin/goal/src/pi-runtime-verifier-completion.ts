/**
 * Default noninteractive settlement-review exhaustion runtime scenario.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import {
  requireCondition,
  settleGoalRun,
} from './pi-runtime-verifier-access.ts';
import type { GoalRuntimeHarness, } from './pi-runtime-verifier-harness.ts';

/**
 * Verify discovered settlement review terminates when reviewers are unavailable.
 *
 * @param harness - real-loader harness positioned on active branch
 *
 * @returns exhaustion scenario summary
 *
 * @throws when tool inventory, terminal state, or footer differs
 *
 * @example
 * ```ts
 * await verifyDefaultCompletionExhaustion(harness);
 * ```
 */
async function verifyDefaultCompletionExhaustion(
  harness: GoalRuntimeHarness,
): Promise<string> {
  requireCondition({
    condition: harness.extension
      .tools
      .size
      === 0,
    message: 'goal extension exposed a primary-model completion tool',
  },);
  await settleGoalRun({
    harness,
    stopReason: 'stop',
  },);
  /**
   * Latest persisted private goal-state event.
   */
  const latestGoalEvent = harness.sessionManager
    .getBranch()
    .toReversed()
    .find(function isGoalStateEntry(
      entry: ForeignBorrowed<ReturnType<GoalRuntimeHarness['sessionManager']['getBranch']>[number]>,
    ) {
      return (entry.type === 'custom') && (entry.customType === 'goal:state');
    },);
  requireCondition({
    condition: (latestGoalEvent?.type === 'custom')
      && (latestGoalEvent.data !== null)
      && ((typeof latestGoalEvent.data) === 'object')
      && ('kind' in latestGoalEvent.data)
      && (latestGoalEvent.data
        .kind
        === 'review_unavailable'),
    message: 'reviewer exhaustion did not persist terminal state',
  },);
  requireCondition({
    condition: harness.statuses
      .at(-1,)
      === 'CLEARED',
    message: 'terminal reviewer exhaustion did not clear footer',
  },);
  return 'noninteractive settlement-review exhaustion with zero primary tools';
}

export { verifyDefaultCompletionExhaustion, };
