/**
 * Registration accessors for real Pi goal loader verification.
 *
 * @module
 */

import type { SessionManager, } from '@earendil-works/pi-coding-agent';

import type {
  GoalRuntimeHarness,
  RuntimeCommand,
  RuntimeHandler,
  RuntimeTool,
} from './pi-runtime-verifier-harness.ts';

/**
 * Retrieve sole loaded handler for lifecycle event.
 *
 * @param harness - loaded goal extension harness
 *
 * @param event - lifecycle event name
 *
 * @returns sole registered handler
 *
 * @throws when registration is absent or duplicated
 *
 * @example
 * ```ts
 * getRuntimeHandler({ harness, event: 'agent_settled' });
 * ```
 */
function getRuntimeHandler(
  {
    harness,
    event,
  }: {
    readonly harness: GoalRuntimeHarness;
    readonly event: string;
  },
): RuntimeHandler {
  /** Handlers captured by real extension loader. */
  const handlers = harness.extension.handlers.get(event,);
  if (handlers?.length !== 1)
    throw new Error(`expected one ${event} handler, received ${handlers?.length ?? 0}`,);
  /** Sole handler after count validation. */
  const [handler,] = handlers;
  if (handler === undefined)
    throw new Error(`missing ${event} handler`,);
  return handler as RuntimeHandler;
}

/**
 * Retrieve loaded `/goal` command callback.
 *
 * @param harness - loaded goal extension harness
 *
 * @returns registered command callback
 *
 * @throws when command is absent
 *
 * @example
 * ```ts
 * getGoalCommand(harness)('objective', harness.context);
 * ```
 */
function getGoalCommand(harness: GoalRuntimeHarness,): RuntimeCommand {
  /** Goal command discovered from package default factory. */
  const command = harness.extension.commands.get('goal',);
  if (command === undefined)
    throw new Error('discovered goal command is absent',);
  return command.handler;
}

/**
 * Retrieve loaded `goal_complete` callback.
 *
 * @param harness - loaded goal extension harness
 *
 * @returns registered tool callback
 *
 * @throws when completion tool is absent
 *
 * @example
 * ```ts
 * getGoalCompletionTool(harness)('call', {}, undefined, undefined, harness.context);
 * ```
 */
function getGoalCompletionTool(harness: GoalRuntimeHarness,): RuntimeTool {
  /** Completion tool discovered from package default factory. */
  const tool = harness.extension.tools.get('goal_complete',);
  if (tool === undefined)
    throw new Error('discovered goal_complete tool is absent',);
  return tool.definition.execute as RuntimeTool;
}

/**
 * Find active generation from latest persisted goal transition.
 *
 * @param sessionManager - disposable session manager
 *
 * @returns latest generation identity
 *
 * @throws when no goal transition carries generation identity
 *
 * @example
 * ```ts
 * activeGoalGeneration(sessionManager);
 * ```
 */
function activeGoalGeneration(sessionManager: SessionManager,): string {
  /** Latest state entry carrying generation identity. */
  const entry = sessionManager
    .getBranch()
    .toReversed()
    .find(function hasGeneration(candidate,) {
      if ((candidate.type !== 'custom') || (candidate.customType !== 'goal:state'))
        return false;
      return (candidate.data !== null)
        && ((typeof candidate.data) === 'object')
        && ('generationId' in candidate.data)
        && ((typeof candidate.data.generationId) === 'string');
    },);
  if ((entry === undefined) || (entry.type !== 'custom'))
    throw new Error('active goal generation is absent from disposable session',);
  /** Validated event payload carrying generation identity. */
  const data = entry.data as Readonly<Record<string, unknown>>;
  if ((typeof data.generationId) !== 'string')
    throw new Error('active goal generation has invalid payload',);
  return data.generationId;
}

/**
 * Require verifier condition with focused diagnostic.
 *
 * @param condition - runtime observation to require
 *
 * @param message - failure diagnostic
 *
 * @throws when condition is false
 *
 * @example
 * ```ts
 * requireCondition(true, 'must pass');
 * ```
 */
function requireCondition(
  condition: boolean,
  message: string,
): asserts condition {
  if (!condition)
    throw new Error(message,);
}

/**
 * Require exact mutable capture count without narrowing later observations.
 *
 * @param actual - observed capture count
 *
 * @param expected - required capture count
 *
 * @param message - failure diagnostic
 *
 * @throws when counts differ
 *
 * @example
 * ```ts
 * requireCount(1, 1, 'one event');
 * ```
 */
function requireCount(
  actual: number,
  expected: number,
  message: string,
): void {
  if (actual !== expected)
    throw new Error(`${message}: expected ${expected}, received ${actual}`,);
}

/**
 * Drive one real-loader event callback.
 *
 * @param harness - disposable loaded extension harness
 *
 * @param type - registered Pi lifecycle event
 *
 * @param event - focused event fixture
 *
 * @example
 * ```ts
 * await emitGoalEvent({ harness, type: 'agent_settled', event: { type: 'agent_settled' } });
 * ```
 */
async function emitGoalEvent(
  {
    harness,
    type,
    event,
  }: {
    readonly harness: GoalRuntimeHarness;
    readonly type: string;
    readonly event: Readonly<Record<string, unknown>>;
  },
): Promise<void> {
  await getRuntimeHandler({ harness, event: type, })(
    event,
    harness.context,
  );
}

/**
 * Emit final assistant stop reason followed by final settlement.
 *
 * @param harness - disposable loaded extension harness
 *
 * @param stopReason - Pi assistant terminal reason
 *
 * @example
 * ```ts
 * await settleGoalRun({ harness, stopReason: 'stop' });
 * ```
 */
async function settleGoalRun(
  {
    harness,
    stopReason,
  }: {
    readonly harness: GoalRuntimeHarness;
    readonly stopReason: 'aborted' | 'error' | 'length' | 'stop';
  },
): Promise<void> {
  await emitGoalEvent({
    harness,
    type: 'agent_end',
    event: {
      type: 'agent_end',
      messages: [{ role: 'assistant', stopReason, },],
    },
  },);
  await emitGoalEvent({
    harness,
    type: 'agent_settled',
    event: { type: 'agent_settled', },
  },);
}

export {
  activeGoalGeneration,
  emitGoalEvent,
  getGoalCommand,
  getGoalCompletionTool,
  getRuntimeHandler,
  requireCondition,
  requireCount,
  settleGoalRun,
};
