/**
 * Built-artifact tests for Pi goal lifecycle adapter.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { registerGoalLifecycle, } from '../dist/final/node/index.mjs';

/**
 * Broad lifecycle callback shape captured by fake Pi registration boundary.
 */
type CapturedHandler = (
  event: unknown,
  context: ExtensionContext,
) => unknown;

/**
 * Captured command callback shape.
 */
type CapturedCommandHandler = (
  args: string,
  context: ExtensionCommandContext,
) => Promise<void>;

/**
 * Fake Pi lifecycle harness state.
 */
type LifecycleHarness = {
  readonly api: ExtensionAPI;
  readonly handlers: Readonly<Record<string, CapturedHandler>>;
  readonly command: CapturedCommandHandler;
  readonly appended: unknown[];
  readonly messages: unknown[];
  readonly statuses: string[];
  readonly notifications: string[];
  readonly context: ExtensionCommandContext;
};

/**
 * Build focused fake Pi API and context for lifecycle contract checks.
 *
 * @param branch - selected-branch entries returned by session manager
 *
 * @returns captured registrations and observable effects
 *
 * @example
 * ```ts
 * const harness = lifecycleHarness([]);
 * ```
 */
function lifecycleHarness(branch: readonly unknown[],): LifecycleHarness {
  /** Captured lifecycle callbacks by event name. */
  const handlers: Record<string, CapturedHandler> = {};
  /** Captured command handlers by command name. */
  const commands: Record<string, CapturedCommandHandler> = {};
  /** Custom entries appended by extension. */
  const appended: unknown[] = [];
  /** Custom messages sent by extension. */
  const messages: unknown[] = [];
  /** Footer status values observed in order. */
  const statuses: string[] = [];
  /** UI notifications observed in order. */
  const notifications: string[] = [];
  /** Focused fake API implementing surfaces used by goal lifecycle. */
  const api = {
    on(event: string, handler: CapturedHandler,) {
      handlers[event] = handler;
    },
    registerCommand(
      name: string,
      options: { readonly handler: CapturedCommandHandler; },
    ) {
      commands[name] = options.handler;
    },
    appendEntry(_customType: string, data: unknown,) {
      appended.push(data,);
    },
    sendMessage(message: unknown,) {
      messages.push(message,);
    },
  } as unknown as ExtensionAPI;
  /** Focused context implementing surfaces used by goal lifecycle. */
  const context = {
    mode: 'tui',
    hasUI: true,
    ui: {
      // oxlint-disable-next-line no-restricted-syntax/no-nullish-union -- Mirrors external ExtensionUIContext.setStatus parameter exactly at fake boundary.
      setStatus(_key: string, text: string | undefined,) {
        statuses.push(text ?? 'CLEARED',);
      },
      notify(message: string,) {
        notifications.push(message,);
      },
    },
    sessionManager: {
      getBranch() {
        return branch;
      },
      getLeafId() {
        return 'leaf-current';
      },
    },
    isIdle() {
      return true;
    },
    hasPendingMessages() {
      return false;
    },
  } as unknown as ExtensionCommandContext;
  registerGoalLifecycle({
    pi: api,
    services: {
      createId: function createFixtureId() {
        return 'fixture-id';
      },
      now: function fixtureNow() {
        return '2026-07-16T00:00:00.000Z';
      },
    },
  },);
  /** Registered strict goal command. */
  const command = commands.goal;
  if (command === undefined)
    throw new Error('goal command was not registered',);
  return {
    api,
    handlers,
    command,
    appended,
    messages,
    statuses,
    notifications,
    context,
  };
}

/**
 * Retrieve required captured lifecycle handler.
 *
 * @param harness - fake lifecycle harness
 *
 * @param eventName - registered lifecycle event name
 *
 * @returns captured event callback
 *
 * @throws when lifecycle registration is absent
 *
 * @example
 * ```ts
 * requiredHandler(harness, 'session_start');
 * ```
 */
function requiredHandler(
  harness: LifecycleHarness,
  eventName: string,
): CapturedHandler {
  /** Captured handler for requested lifecycle event. */
  const handler = harness.handlers[eventName];
  if (handler === undefined)
    throw new Error(`missing ${eventName} lifecycle registration`,);
  return handler;
}

await describe({
  name: registerGoalLifecycle.name,
  children: [
    it({
      name: 'restores active branch, rotates generation, injects prompt, and continues only at final settlement',
      fn: async () => {
        /** Active branch fixture with unrelated custom entry. */
        const harness = lifecycleHarness([
          {
            type: 'custom',
            customType: 'unrelated',
            data: { ignored: true, },
          },
          {
            type: 'custom',
            customType: 'goal:state',
            data: {
              kind: 'run_started',
              runId: 'run-existing',
              generationId: 'generation-existing',
              objective: 'Restore exact objective',
              startedAt: '2026-07-15T00:00:00.000Z',
              startBoundary: 'leaf-start',
              continuationSequence: 0,
              transitionedAt: '2026-07-15T00:00:00.000Z',
            },
          },
        ],);
        await requiredHandler(harness, 'session_start',)(
          { type: 'session_start', reason: 'startup', },
          harness.context,
        );
        expect(harness.statuses,).toEqual([
          'goal Restore e…',
          'goal Restore e…',
        ],);
        expect(harness.appended,).toHaveLength(1,);
        expect(harness.messages,).toHaveLength(0,);
        /** Per-turn prompt injection result. */
        const promptResult = await requiredHandler(harness, 'before_agent_start',)(
          {
            type: 'before_agent_start',
            prompt: 'continue',
            systemPrompt: 'base prompt',
            systemPromptOptions: { cwd: process.cwd(), },
          },
          harness.context,
        );
        expect(JSON.stringify(promptResult,),).toContain('Restore exact objective',);
        await requiredHandler(harness, 'agent_settled',)(
          { type: 'agent_settled', },
          harness.context,
        );
        expect(harness.appended,).toHaveLength(2,);
        expect(harness.messages,).toHaveLength(1,);
        expect(Object.hasOwn(harness.handlers, 'tool_call',),).toBe(false,);
      },
    },),
    it({
      name: 'starts, replaces without confirmation, rejects removed forms, and clears idempotently',
      fn: async () => {
        /** Empty selected-branch harness. */
        const harness = lifecycleHarness([],);
        await harness.command('First objective', harness.context,);
        expect(harness.appended,).toHaveLength(1,);
        expect(harness.messages,).toHaveLength(1,);
        await harness.command('Second objective', harness.context,);
        expect(harness.appended,).toHaveLength(2,);
        expect(harness.messages,).toHaveLength(2,);
        expect(harness.notifications,).toHaveLength(0,);
        await harness.command('status', harness.context,);
        expect(harness.notifications,).toEqual([
          'Usage: /goal <objective> or /goal clear',
        ],);
        await harness.command('clear', harness.context,);
        expect(harness.appended,).toHaveLength(3,);
        await harness.command('clear', harness.context,);
        expect(harness.notifications,).toEqual([
          'Usage: /goal <objective> or /goal clear',
          'Goal cleared: Second objective',
          'No goal is active.',
        ],);
      },
    },),
    it({
      name: 'leaves active goal unchanged after abort and resumes on later ordinary settlement',
      fn: async () => {
        /** Active goal runtime under abort. */
        const harness = lifecycleHarness([],);
        await harness.command('Survive explicit abort', harness.context,);
        await requiredHandler(harness, 'agent_end',)(
          {
            type: 'agent_end',
            messages: [{ role: 'assistant', stopReason: 'aborted', },],
          },
          harness.context,
        );
        await requiredHandler(harness, 'agent_settled',)(
          { type: 'agent_settled', },
          harness.context,
        );
        expect(harness.appended,).toHaveLength(1,);
        expect(harness.messages,).toHaveLength(1,);
        await requiredHandler(harness, 'agent_end',)(
          {
            type: 'agent_end',
            messages: [{ role: 'assistant', stopReason: 'stop', },],
          },
          harness.context,
        );
        await requiredHandler(harness, 'agent_settled',)(
          { type: 'agent_settled', },
          harness.context,
        );
        expect(harness.appended,).toHaveLength(2,);
        expect(harness.messages,).toHaveLength(2,);
      },
    },),
    it({
      name: 'reconstructs branch on tree and compaction and suppresses post-shutdown settlement',
      fn: async () => {
        /** Empty selected branch harness. */
        const harness = lifecycleHarness([],);
        await harness.command('Temporary objective', harness.context,);
        await requiredHandler(harness, 'session_tree',)(
          { type: 'session_tree', newLeafId: null, oldLeafId: 'leaf-current', },
          harness.context,
        );
        /** Empty target branch clears footer without sending a turn. */
        const [lastStatus,] = harness.statuses.toReversed();
        expect(lastStatus,).toBe('CLEARED',);
        expect(harness.messages,).toHaveLength(1,);
        await requiredHandler(harness, 'session_compact',)(
          {
            type: 'session_compact',
            compactionEntry: {},
            fromExtension: false,
            reason: 'manual',
            willRetry: false,
          },
          harness.context,
        );
        await requiredHandler(harness, 'session_shutdown',)(
          { type: 'session_shutdown', reason: 'quit', },
          harness.context,
        );
        await requiredHandler(harness, 'agent_settled',)(
          { type: 'agent_settled', },
          harness.context,
        );
        expect(harness.messages,).toHaveLength(1,);
      },
    },),
  ],
},);
