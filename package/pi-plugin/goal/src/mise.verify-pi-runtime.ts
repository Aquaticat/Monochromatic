/**
 * Exercises built goal package through real Pi discovery and runtime boundaries.
 *
 * @module
 */

import {
  mkdirSync,
  mkdtempDisposableSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';
import { tmpdir, } from 'node:os';

import {
  activeGoalGeneration,
  emitGoalEvent,
  getGoalCommand,
  getGoalCompletionTool,
  requireCondition,
  requireCount,
  settleGoalRun,
} from './pi-runtime-verifier-access.ts';
import { createGoalRuntimeHarness, } from './pi-runtime-verifier-harness.ts';
import { verifyInjectedReviewerOutcomes, } from './pi-runtime-verifier-review.ts';
import { verifyOrdinaryToolsAfterAbort, } from './pi-runtime-verifier-tools.ts';

/**
 * Exercise discovered command, lifecycle, branch, and default completion paths.
 *
 * @param packageDirectory - built package discovered through manifest
 *
 * @param agentDirectory - disposable Pi global directory
 *
 * @param sessionDirectory - disposable persisted sessions
 *
 * @returns runtime scenario summary
 *
 * @throws when any lifecycle or completion invariant differs
 *
 * @example
 * ```ts
 * await verifyDiscoveredGoalRuntime({ packageDirectory, agentDirectory, sessionDirectory });
 * ```
 */
async function verifyDiscoveredGoalRuntime(
  {
    packageDirectory,
    agentDirectory,
    sessionDirectory,
  }: {
    readonly packageDirectory: string;
    readonly agentDirectory: string;
    readonly sessionDirectory: string;
  },
): Promise<string> {
  /** Real package discovery with runtime actions bound to disposable session. */
  const harness = await createGoalRuntimeHarness({
    packageDirectory,
    agentDirectory,
    sessionDirectory,
  },);
  requireCondition(!harness.extension.handlers.has('tool_call',), 'discovered package registered forbidden tool_call blocker',);
  /** Loaded slash command under test. */
  const command = getGoalCommand(harness,);
  await command('First disposable objective', harness.context,);
  /** Leaf retaining first goal start and kickoff for later branch reconstruction. */
  const firstLeaf = harness.sessionManager.getLeafId();
  requireCondition(firstLeaf !== null, 'first goal did not persist a session leaf',);
  await command('Replacement disposable objective', harness.context,);
  /** Leaf retaining immediate replacement before continuations. */
  const replacementLeaf = harness.sessionManager.getLeafId();
  requireCondition(replacementLeaf !== null, 'replacement goal did not persist a session leaf',);
  requireCount(harness.messages.length, 2, 'start and immediate replacement kickoff messages',);
  requireCondition(harness.statuses.at(-1,)?.includes('Replaceme',) === true, 'replacement did not update active footer',);

  /** Natural stop emits exactly one continuation. */
  await settleGoalRun({ harness, stopReason: 'stop', },);
  requireCount(harness.messages.length, 3, 'natural settlement continuation',);
  /** Output exhaustion follows same final-settlement continuation path. */
  await settleGoalRun({ harness, stopReason: 'length', },);
  requireCount(harness.messages.length, 4, 'length settlement continuation',);

  /** Compaction itself emits nothing; later settlement emits once. */
  const beforeCompaction = harness.messages.length;
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
  requireCondition(harness.messages.length === beforeCompaction, 'compaction emitted premature continuation',);
  await settleGoalRun({ harness, stopReason: 'stop', },);
  requireCondition(harness.messages.length === beforeCompaction + 1, 'post-compaction settlement did not emit once',);

  /** Explicit abort is inert while ordinary settled error resumes continuation. */
  const beforeAbort = harness.messages.length;
  await settleGoalRun({ harness, stopReason: 'aborted', },);
  requireCondition(harness.messages.length === beforeAbort, 'abort emitted goal-owned continuation',);
  await settleGoalRun({ harness, stopReason: 'error', },);
  requireCondition(harness.messages.length === beforeAbort + 1, 'settled error did not continue active goal',);

  /** Clear wins over callback captured before final settlement. */
  await emitGoalEvent({
    harness,
    type: 'agent_end',
    event: {
      type: 'agent_end',
      messages: [{ role: 'assistant', stopReason: 'stop', },],
    },
  },);
  await command('clear', harness.context,);
  const afterClear = harness.messages.length;
  await emitGoalEvent({
    harness,
    type: 'agent_settled',
    event: { type: 'agent_settled', },
  },);
  requireCondition(harness.messages.length === afterClear, 'clear did not invalidate delayed settlement',);

  /** Restoration and tree navigation reconstruct without automatic model trigger. */
  await command('Reloaded disposable objective', harness.context,);
  const beforeRestore = harness.messages.length;
  await emitGoalEvent({ harness, type: 'session_start', event: { type: 'session_start', reason: 'resume', }, },);
  requireCondition(harness.messages.length === beforeRestore, 'session restoration triggered model turn',);
  harness.sessionManager.branch(firstLeaf,);
  await emitGoalEvent({ harness, type: 'session_tree', event: { type: 'session_tree', }, },);
  requireCondition(harness.messages.length === beforeRestore, 'tree reconstruction triggered model turn',);
  requireCondition(harness.statuses.at(-1,)?.includes('First',) === true, 'tree reconstruction used abandoned branch state',);
  harness.sessionManager.branch(replacementLeaf,);
  await emitGoalEvent({ harness, type: 'session_tree', event: { type: 'session_tree', }, },);

  /** Default noninteractive exhaustion terminates with persisted diagnostic. */
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
  /** Completion generation reconstructed from selected replacement branch. */
  const generationId = activeGoalGeneration(harness.sessionManager,);
  const completion = await getGoalCompletionTool(harness,)(
    completionCallId,
    {
      goal_id: generationId,
      summary: 'Disposable runtime verification completed.',
    },
    undefined,
    undefined,
    harness.context,
  );
  requireCondition(completion.terminate === true, 'noninteractive reviewer exhaustion did not terminate',);
  requireCondition(completion.details.outcome === 'review_unavailable', 'reviewer exhaustion returned wrong outcome',);
  requireCondition(harness.statuses.at(-1,) === 'CLEARED', 'terminal reviewer exhaustion did not clear footer',);
  return 'manifest discovery, lifecycle continuation, abort, compaction, clear, branch reconstruction, exhaustion';
}

/**
 * Run all disposable Pi consumer-boundary checks.
 *
 * @returns verification result text
 *
 * @example
 * ```ts
 * console.log(await verifyPiGoalRuntime());
 * ```
 */
async function verifyPiGoalRuntime(): Promise<string> {
  using temporary = mkdtempDisposableSync(join(tmpdir(), 'pi-goal-runtime-',),);
  /** Disposable Pi global directory. */
  const agentDirectory = join(temporary.path, 'agent',);
  /** Disposable persisted session directory. */
  const sessionDirectory = join(temporary.path, 'sessions',);
  /** Disposable ordinary-tool workspace. */
  const workspaceDirectory = join(temporary.path, 'workspace',);
  for (const directory of [agentDirectory, sessionDirectory, workspaceDirectory,])
    mkdirSync(directory, { recursive: true, },);
  writeFileSync(join(agentDirectory, 'settings.json',), '{}\n',);
  /** Goal package directory is task working directory. */
  const packageDirectory = process.cwd();
  const lifecycle = await verifyDiscoveredGoalRuntime({ packageDirectory, agentDirectory, sessionDirectory, },);
  const reviews = await verifyInjectedReviewerOutcomes();
  const tools = await verifyOrdinaryToolsAfterAbort({
    packageDirectory,
    agentDirectory,
    workspaceDirectory,
    sessionDirectory: join(temporary.path, 'tool-sessions',),
  },);
  return `pi-goal Pi runtime verified: ${lifecycle}; ${reviews}; tools ${tools.join(', ')}`;
}

console.log(await verifyPiGoalRuntime(),);
