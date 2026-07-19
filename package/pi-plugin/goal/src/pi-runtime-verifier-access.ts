/**
 * Registration accessors for real Pi goal loader verification.
 *
 * @module
 */

import type {
  ExtensionCommandContext,
  ExtensionContext,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { GoalCompletionResult, } from '../dist/final/node/index.mjs';
import type {
  GoalRuntimeHarness,
  RuntimeCommand,
  RuntimeHandler,
  RuntimeTool,
} from './pi-runtime-verifier-harness.ts';

/**
 * Retrieve loaded handlers for one lifecycle event as a sequential composite.
 *
 * @param harness - loaded goal extension harness
 *
 * @param event - lifecycle event name
 *
 * @returns registered handlers invoked in extension registration order
 *
 * @throws when registration is absent
 *
 * @example
 * ```ts
 * getRuntimeHandler({ harness, event: 'agent_settled' });
 * ```
 */
function getRuntimeHandler(
  {
    harness,
    event: eventName,
  }: {
    readonly harness: GoalRuntimeHarness;
    readonly event: string;
  },
): RuntimeHandler {
  /**
   * Handlers captured by real extension loader.
   */
  const handlers = harness.extension
    .handlers
    .get(eventName,);
  if ((handlers === undefined) || (handlers.length === 0))
    throw new Error(`missing ${eventName} handler`,);
  /**
   * Narrowed nonempty handler collection retained across nested function boundary.
   */
  const loadedHandlers: NonNullable<typeof handlers> = handlers;
  /**
   * Invoke every foreign callback using Pi's registration order.
   *
   * @param input - externally owned lifecycle payload and Pi context
   *
   * @mutates input - loaded handlers may mutate or retain event and context references
   *
   * @example
   * ```ts
   * await invokeLoadedHandlers({ event: { type: 'agent_settled' }, context });
   * ```
   */
  async function invokeLoadedHandlers(
    input: ForeignBorrowed<{
      readonly event: Readonly<Record<string, unknown>>;
      readonly context: ExtensionContext;
    }>,
  ): Promise<void> {
    for (const handler of loadedHandlers) {
      // oxlint-disable-next-line no-await-in-loop -- Pi lifecycle handlers chain in registration order; parallel dispatch would not model the consumer boundary.
      await handler(
        input.event,
        input.context,
      );
    }
  }
  return invokeLoadedHandlers;
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
 * getGoalCommand(harness)({ args: 'objective', context: harness.context });
 * ```
 */
function getGoalCommand(harness: GoalRuntimeHarness,): RuntimeCommand {
  /**
   * Goal command discovered from package default factory.
   */
  const command = harness.extension
    .commands
    .get('goal',);
  if (command === undefined)
    throw new Error('discovered goal command is absent',);
  /**
   * Narrowed command retained across nested declaration boundary.
   */
  const loadedCommand: NonNullable<typeof command> = command;
  /**
   * Invoke foreign goal command selected from loaded extension.
   *
   * @param input - exact arguments and externally owned Pi command context
   *
   * @mutates input - loadedCommand.handler may invoke or retain context capabilities
   *
   * @example
   * ```ts
   * await invokeLoadedCommand({ args: 'objective', context });
   * ```
   */
  async function invokeLoadedCommand(
    input: ForeignBorrowed<{
      readonly args: string;
      readonly context: ExtensionCommandContext;
    }>,
  ): Promise<void> {
    await loadedCommand.handler(
      input.args,
      input.context,
    );
  }
  return invokeLoadedCommand;
}

/**
 * Narrow unknown loaded tool result to goal completion contract.
 *
 * @param value - loaded extension tool result
 *
 * @returns whether value carries recognized goal completion outcome
 *
 * @example
 * ```ts
 * isGoalCompletionResult({ content: [], details: { outcome: 'approved' } });
 * ```
 */
function isGoalCompletionResult(value: unknown,): value is GoalCompletionResult {
  if ((value === null) || ((typeof value) !== 'object'))
    return false;
  if (!(('content' in value) && Array.isArray(value.content,)
    && ('details' in value)
    && (value.details !== null)
    && ((typeof value.details) === 'object')
    && ('outcome' in value.details)))
    return false;
  /**
   * Unknown outcome value after structural details validation.
   */
  const { outcome, } = value.details;
  return (outcome === 'approved')
    || (outcome === 'denied')
    || (outcome === 'rejected')
    || (outcome === 'stale')
    || (outcome === 'review_unavailable');
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
 * getGoalCompletionTool(harness)({ toolCallId: 'call', params: {}, context: harness.context });
 * ```
 */
function getGoalCompletionTool(harness: GoalRuntimeHarness,): RuntimeTool {
  /**
   * Completion tool discovered from package default factory.
   */
  const tool = harness.extension
    .tools
    .get('goal_complete',);
  if (tool === undefined)
    throw new Error('discovered goal_complete tool is absent',);
  /**
   * Narrowed tool retained across nested declaration boundary.
   */
  const loadedTool: NonNullable<typeof tool> = tool;
  /**
   * Invoke foreign completion tool selected from loaded extension.
   *
   * @param input - externally owned completion callback values
   *
   * @returns validated goal completion result
   *
   * @mutates input - definition.execute may mutate or retain params, context, or signal references
   *
   * @throws when loaded completion result violates goal contract
   *
   * @example
   * ```ts
   * await invokeLoadedCompletion({ toolCallId: 'call', params: {}, context });
   * ```
   */
  async function invokeLoadedCompletion(
    input: ForeignBorrowed<{
      readonly toolCallId: string;
      readonly params: Readonly<Record<string, unknown>>;
      readonly context: ExtensionContext;
      readonly signal?: AbortSignal;
    }>,
  ): ReturnType<RuntimeTool> {
    /**
     * Borrowed callback values retained through object-boundary destructuring.
     */
    const {
      toolCallId,
      params,
      context,
      signal,
    } = input;
    /**
     * Generic definition crossing loaded-tool registry boundary.
     */
    const { definition, } = loadedTool;
    /**
     * Result crossing generic loaded-tool registry boundary.
     */
    const result: unknown = await definition.execute(
      toolCallId,
      params,
      signal,
      undefined,
      context,
    );
    if (!isGoalCompletionResult(result,))
      throw new Error('loaded goal_complete returned invalid result details',);
    return result;
  }
  return invokeLoadedCompletion;
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
  /**
   * Latest state entry carrying generation identity.
   */
  const entry = sessionManager
    .getBranch()
    .toReversed()
    .find(function hasGeneration(
      candidate: ForeignBorrowed<ReturnType<SessionManager['getBranch']>[number]>,
    ) {
      if ((candidate.type !== 'custom') || (candidate.customType !== 'goal:state'))
        return false;
      return (candidate.data !== null)
        && ((typeof candidate.data) === 'object')
        && ('generationId' in candidate.data)
        && ((typeof candidate.data
          .generationId) === 'string');
    },);
  if ((entry === undefined) || (entry.type !== 'custom'))
    throw new Error('active goal generation is absent from disposable session',);
  /**
   * Revalidated event payload after array predicate boundary.
   */
  const { data, } = entry;
  if ((data === null)
    || ((typeof data) !== 'object')
    || (!('generationId' in data))
    || ((typeof data.generationId) !== 'string'))
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
 * requireCondition({ condition: true, message: 'must pass' });
 * ```
 */
function requireCondition(
  {
    condition,
    message,
  }: {
    readonly condition: boolean;
    readonly message: string;
  },
): void {
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
 * requireCount({ actual: 1, expected: 1, message: 'one event' });
 * ```
 */
function requireCount(
  {
    actual,
    expected,
    message,
  }: {
    readonly actual: number;
    readonly expected: number;
    readonly message: string;
  },
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
  await getRuntimeHandler({
    harness,
    event: type,
  })({
    event,
    context: harness.context,
  },);
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
      messages: [{
        role: 'assistant',
        stopReason,
      },],
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
