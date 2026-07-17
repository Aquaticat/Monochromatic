/**
 * Discovered command, settlement, abort, clear, and branch runtime scenarios.
 *
 * @module
 */

import {
  emitGoalEvent,
  getGoalCommand,
  requireCondition,
  requireCount,
  settleGoalRun,
} from './pi-runtime-verifier-access.ts';
import {
  createGoalRuntimeHarness,
  type GoalRuntimeHarness,
} from './pi-runtime-verifier-harness.ts';

/**
 * Kickoff messages after start and immediate replacement.
 */
const REPLACEMENT_MESSAGE_COUNT = 2;

/**
 * Messages after natural settlement continuation.
 */
const NATURAL_MESSAGE_COUNT = REPLACEMENT_MESSAGE_COUNT + 1;

/**
 * Messages after output-exhaustion continuation.
 */
const LENGTH_MESSAGE_COUNT = NATURAL_MESSAGE_COUNT + 1;

/**
 * Loaded lifecycle verification result retained for completion scenario.
 */
type GoalFlowResult = {
  readonly harness: GoalRuntimeHarness;
  readonly summary: string;
};

/**
 * Exercise discovered command, lifecycle, and selected-branch reconstruction.
 *
 * @param packageDirectory - built package discovered through manifest
 *
 * @param agentDirectory - disposable Pi global directory
 *
 * @param sessionDirectory - disposable persisted sessions
 *
 * @returns runtime harness positioned on active replacement branch
 *
 * @throws when any lifecycle invariant differs
 *
 * @example
 * ```ts
 * await verifyDiscoveredGoalFlow({ packageDirectory, agentDirectory, sessionDirectory });
 * ```
 */
async function verifyDiscoveredGoalFlow(
  {
    packageDirectory,
    agentDirectory,
    sessionDirectory,
  }: {
    readonly packageDirectory: string;
    readonly agentDirectory: string;
    readonly sessionDirectory: string;
  },
): Promise<GoalFlowResult> {
  /**
   * Real package discovery with runtime actions bound to disposable session.
   */
  const harness = await createGoalRuntimeHarness({
    packageDirectory,
    agentDirectory,
    sessionDirectory,
  },);
  requireCondition({
    condition: !harness.extension
      .handlers
      .has('tool_call',),
    message: 'discovered package registered forbidden tool_call blocker',
  },);
  /**
   * Loaded slash command under test.
   */
  const command = getGoalCommand(harness,);
  await command({
    args: 'First disposable objective',
    context: harness.context,
  },);
  /**
   * Leaf retaining first goal start and kickoff for branch reconstruction.
   */
  const firstLeaf = harness.sessionManager
    .getLeafId();
  if (firstLeaf === null)
    throw new Error('first goal did not persist a session leaf',);
  await command({
    args: 'Replacement disposable objective',
    context: harness.context,
  },);
  /**
   * Leaf retaining immediate replacement before continuations.
   */
  const replacementLeaf = harness.sessionManager
    .getLeafId();
  if (replacementLeaf === null)
    throw new Error('replacement goal did not persist a session leaf',);
  requireCount({
    actual: harness.messages
      .length,
    expected: REPLACEMENT_MESSAGE_COUNT,
    message: 'start and immediate replacement kickoff messages',
  },);
  requireCondition({
    condition: harness.statuses
      .at(-1,)
      ?.includes('Replaceme',)
      === true,
    message: 'replacement did not update active footer',
  },);

  await settleGoalRun({
    harness,
    stopReason: 'stop',
  },);
  requireCount({
    actual: harness.messages
      .length,
    expected: NATURAL_MESSAGE_COUNT,
    message: 'natural settlement continuation',
  },);
  await settleGoalRun({
    harness,
    stopReason: 'length',
  },);
  requireCount({
    actual: harness.messages
      .length,
    expected: LENGTH_MESSAGE_COUNT,
    message: 'length settlement continuation',
  },);

  /**
   * Message count before compaction recovery.
   */
  const beforeCompaction = harness.messages
    .length;
  await emitGoalEvent({
    harness,
    type: 'session_compact',
    event: {
      type: 'session_compact',
      compactionEntry: {},
      fromExtension: false,
      reason: 'overflow',
      willRetry: true,
    },
  },);
  requireCondition({
    condition: harness.messages
      .length
      === beforeCompaction,
    message: 'compaction emitted premature continuation',
  },);
  await settleGoalRun({
    harness,
    stopReason: 'stop',
  },);
  requireCondition({
    condition: harness.messages
      .length
      === (beforeCompaction + 1),
    message: 'post-compaction settlement did not emit once',
  },);

  /**
   * Message count before inert abort.
   */
  const beforeAbort = harness.messages
    .length;
  await settleGoalRun({
    harness,
    stopReason: 'aborted',
  },);
  requireCondition({
    condition: harness.messages
      .length
      === beforeAbort,
    message: 'abort emitted goal-owned continuation',
  },);
  await settleGoalRun({
    harness,
    stopReason: 'error',
  },);
  requireCondition({
    condition: harness.messages
      .length
      === (beforeAbort + 1),
    message: 'settled error did not continue active goal',
  },);

  await emitGoalEvent({
    harness,
    type: 'agent_end',
    event: {
      type: 'agent_end',
      messages: [{
        role: 'assistant',
        stopReason: 'stop',
      },],
    },
  },);
  await command({
    args: 'clear',
    context: harness.context,
  },);
  /**
   * Message count after clear invalidates captured settlement.
   */
  const afterClear = harness.messages
    .length;
  await emitGoalEvent({
    harness,
    type: 'agent_settled',
    event: { type: 'agent_settled', },
  },);
  requireCondition({
    condition: harness.messages
      .length
      === afterClear,
    message: 'clear did not invalidate delayed settlement',
  },);

  await command({
    args: 'Reloaded disposable objective',
    context: harness.context,
  },);
  /**
   * Message count before restoration and tree navigation.
   */
  const beforeRestore = harness.messages
    .length;
  await emitGoalEvent({
    harness,
    type: 'session_start',
    event: {
      type: 'session_start',
      reason: 'resume',
    },
  },);
  requireCondition({
    condition: harness.messages
      .length
      === beforeRestore,
    message: 'session restoration triggered model turn',
  },);
  harness.sessionManager
    .branch(firstLeaf,);
  await emitGoalEvent({
    harness,
    type: 'session_tree',
    event: { type: 'session_tree', },
  },);
  requireCondition({
    condition: harness.messages
      .length
      === beforeRestore,
    message: 'tree reconstruction triggered model turn',
  },);
  requireCondition({
    condition: harness.statuses
      .at(-1,)
      ?.includes('First',)
      === true,
    message: 'tree reconstruction used abandoned branch state',
  },);
  harness.sessionManager
    .branch(replacementLeaf,);
  await emitGoalEvent({
    harness,
    type: 'session_tree',
    event: { type: 'session_tree', },
  },);
  return {
    harness,
    summary: 'manifest discovery, lifecycle continuation, abort, compaction, clear, and branch reconstruction',
  };
}

export { verifyDiscoveredGoalFlow, };
export type { GoalFlowResult, };
