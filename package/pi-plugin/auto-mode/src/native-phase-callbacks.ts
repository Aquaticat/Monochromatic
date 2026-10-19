/**
 Native callbacks for the native phase catalog.

 Hook, normalization, execution, and subscription callbacks keep their original
 identities, order, and return accounting over genuine SDK types. @module
 */
import { setTimeout as wait } from 'node:timers/promises';
import assert from 'node:assert/strict';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type {
  AgentSession,
  AgentToolResult,
  defineTool,
  ExtensionAPI,
  ExtensionHandler,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  normalizePreparedArguments,
  readCommandMember,
  readTrimmedCommandMember
} from './native-phase-value.mjs';
import type {
  FixtureBashDetails,
  FixtureBashTool,
  NativePhaseObservations,
  NativePhasePlan,
  NativePhaseState,
  NativePhaseUpdateDeferred,
  PhaseExecutionReturnGuard,
  SessionEventHandler
} from './native-phase-types.ts';

/**
 Event trace entries retain native call identity in source order.
 */
export type NativePhaseEvents = string[];

/**
 Extension factory registering the original tool call hooks.
 */
export type PhaseExtensionFactory = (api: ExtensionAPI) => void;

/**
 Tool call hook result mirrors the installed SDK handler declaration.
 */
type PhaseToolCallHookResult = ReturnType<ExtensionHandler<ToolCallEvent, ToolCallEventResult>>;

//region Native hooks observe each proposed member around its real execution.

/**
 Build the extension factory registering the original tool call hooks.

 @param plan - mode plan selecting the before-block withholding branch

 @param events - event trace entries recording native call identity

 @returns extension factory registering both original hooks

 @example
 ```ts
 const extensionFactories = [createPhaseExtensionFactory({ plan, events })];
 ```
 */
export function createPhaseExtensionFactory({
  plan,
  events
}: Readonly<{
  plan: NativePhasePlan;
  events: NativePhaseEvents;
}>): PhaseExtensionFactory {
  return function originalCallbacks(pi: ExtensionAPI): void {
    pi.on(
      'tool_call',
      function before(event: ForeignBorrowed<ToolCallEvent>): PhaseToolCallHookResult {
        events.push(`before:${event.toolCallId}`);
        /**
         Command text reaches the hook already normalized by preparation.
         */
        assert.equal(
          readCommandMember(event.input),
          readTrimmedCommandMember(event.input)
        );
        if ((plan.mode === 'before-block') && (event.toolCallId === 'phase-1'))
          return {
            block: true,
            reason: 'Authored native hook withheld this group'
          };
        return undefined;
      }
    );
    pi.on(
      'tool_result',
      function after(event: ForeignBorrowed<ToolResultEvent>): void {
        events.push(`after:${event.toolCallId}`);
      }
    );
  };
}

//endregion

//region The wrapped bash tool keeps original execution identity and accounting.

/**
 Build the execute return guard reproducing the original return accounting.

 @param observations - counters tracking concurrent native execution

 @param events - event trace entries recording native call identity

 @param toolCallId - identifier of the returning member

 @param update - deferred completion awaited by the event subscriber

 @returns dispose guard running the original return accounting

 @example
 ```ts
 using guard = createExecutionReturnGuard({ observations, events, toolCallId, update });
 ```
 */
export function createExecutionReturnGuard({
  observations,
  events,
  toolCallId,
  update
}: Readonly<{
  observations: NativePhaseObservations;
  events: NativePhaseEvents;
  toolCallId: string;
  update: NativePhaseUpdateDeferred;
}>): PhaseExecutionReturnGuard {
  return {
    [Symbol.dispose](): void {
      observations.active--;
      events.push(`returned:${toolCallId}`);
      update.resolve();
    }
  };
}

/**
 Wrap the original bash tool with fixture observation and authored results.

 The original execute and prepareArguments signatures come from the installed
 SDK's published declaration; the wrapper forwards their original identities.

 @param plan - mode plan selecting cancellation and tool failure branches

 @param observations - counters incremented by fixture execution

 @param state - live fixture state retaining abort and deferred updates

 @param events - event trace entries recording native call identity

 @param original - original bash tool definition retaining its execute identity

 @param readSession - lazy reader for the original session created below

 @returns wrapped bash tool with fixture observation callbacks

 @example
 ```ts
 const bash = wrapPhaseBashTool({ plan, observations, state, events, original, readSession });
 ```
 */
export function wrapPhaseBashTool({
  plan,
  observations,
  state,
  events,
  original,
  readSession
}: Readonly<{
  plan: NativePhasePlan;
  observations: NativePhaseObservations;
  state: NativePhaseState;
  events: NativePhaseEvents;
  original: ReturnType<typeof defineTool>;
  readSession: () => AgentSession;
}>): FixtureBashTool {
  return {
    ...original,
    ...(plan.implicitSequential ? { executionMode: 'sequential' } : {}),
    prepareArguments(input: unknown): unknown {
      events.push('prepare');
      /**
       JavaScript performs the original normalization expression verbatim, so
       invalid inputs pass through unchanged for the SDK's later validation.
       */
      const normalized: unknown = normalizePreparedArguments(input);
      return original.prepareArguments?.(normalized)
        ?? normalized;
    },
    async execute(
      toolCallId,
      input,
      signal,
      onUpdate,
      context
    ): Promise<AgentToolResult<FixtureBashDetails>> {
      observations.executions++;
      observations.active++;
      observations.maximumActive = Math.max(
        observations.maximumActive,
        observations.active
      );
      events.push(`execute:${toolCallId}`);
      /**
       Deferred completion keeps the subscriber's update ordering observable.
       */
      const update: NativePhaseUpdateDeferred = Promise.withResolvers();
      state.updates
        .set(
          toolCallId,
          update
        );
      /**
       Missing native update callbacks fail before the authored result is created.
       */
      const sendUpdate = nonNullishOrThrow(onUpdate);
      /**
       SDK update emission preserves this original result identity.
       */
      const authoredUpdate: AgentToolResult<FixtureBashDetails> = {
        content: [{
          type: 'text',
          text: 'authored native update'
        }],
        details: { phaseProbe: true }
      };
      state.authoredUpdates
        .add(authoredUpdate);
      sendUpdate(authoredUpdate);
      /**
       Return accounting runs on every scope exit exactly like the original.
       */
      using guard = createExecutionReturnGuard({
        observations,
        events,
        toolCallId,
        update
      });
      await wait(0);
      if (plan.cancel) {
        state.abortTask = readSession()
          .abort();
        return {
          content: [{
            type: 'text',
            text: 'authored cancellation result'
          }],
          details: {}
        };
      }
      if ((plan.mode === 'tool-error') && (toolCallId === 'phase-1'))
        throw new Error('Authored native tool failure');
      return await original.execute(
        toolCallId,
        input,
        signal,
        onUpdate,
        context
      );
    }
  };
}

//endregion

//region The session subscriber observes native events through original identity.

/**
 Build the session event subscriber recording native lifecycle receipts.

 @param state - live fixture state retaining deferred updates

 @param events - event trace entries recording native call identity

 @returns subscriber handler matching the original subscription

 @example
 ```ts
 const unsubscribe = session.agent.subscribe(createPhaseEventSubscriber({ state, events }));
 ```
 */
export function createPhaseEventSubscriber({
  state,
  events
}: Readonly<{
  state: NativePhaseState;
  events: NativePhaseEvents;
}>): SessionEventHandler {
  return async function nativeEvents(event): Promise<void> {
    if (event.type === 'tool_execution_start')
      events.push(`start:${event.toolCallId}`);
    if (event.type === 'tool_execution_end')
      events.push(`finish:${event.toolCallId}:${event.isError}`);
    if ((event.type === 'message_end')
      && (event.message
      .role
      === 'toolResult'))
      events.push(`message:${event.message
        .toolCallId}`);
    if (event.type === 'tool_execution_update') {
      /**
       Opaque SDK results are matched against the fixture's original emitted objects.
       */
      const partialResult: unknown = event.partialResult;
      if (state.authoredUpdates
        .has(partialResult)) {
        events.push(`update:${event.toolCallId}`);
        await nonNullishOrThrow(state.updates
          .get(event.toolCallId))
          .promise;
        events.push(`updated:${event.toolCallId}`);
      }
    }
  };
}

//endregion
