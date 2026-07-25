/**
 * Tests for auto-mode bypass shortcut behavior.
 *
 * Covers shortcut registration, visible toggle feedback, session restoration,
 * and tool-call short-circuiting while bypass mode is enabled.
 *
 * @module
 */

import type {
  ExtensionAPI,
  ExtensionContext,
  ToolCallEvent,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  BYPASS_ALLOW_KIND,
  BYPASS_ALLOW_REASON,
  BYPASS_ENTRY_TYPE,
  BYPASS_SHORTCUT,
  BYPASS_SOURCE_SHORTCUT,
  BYPASS_STATUS_KEY,
  BYPASS_STATUS_TEXT,
  BYPASS_TOGGLE_KIND,
} from './bypass.ts';

//region Mock infrastructure

/** Minimal handler signature matching pi event and shortcut handlers used here. */
type HandlerFn = (
  arg0?: unknown,
  arg1?: unknown,
) => unknown;

/** Shape of the mock registration map. */
type RegistrationMap = Map<string, HandlerFn[]>;

/** Shape of the mock shortcut map. */
type ShortcutMap = Map<string, {
  handler: HandlerFn;
  definition: unknown;
}>;

/** Custom entry appended via pi.appendEntry. */
type AppendedEntry = {
  /** Custom entry discriminator. */
  readonly customType: string;
  /** Custom entry payload. */
  readonly data: unknown;
};

/** Minimal session entry shape consumed by bypass restoration. */
type SessionEntry = {
  /** Session entry discriminator. */
  readonly type: string;
  /** Custom entry type, present for custom entries. */
  readonly customType?: string;
  /** Custom entry payload. */
  readonly data?: unknown;
};

/** UI notification captured from mock contexts. */
type Notification = {
  /** Notification body. */
  readonly message: string;
  /** Notification severity, when provided. */
  readonly level?: string;
};

/** Mock context plus captured UI side effects. */
type MockContextFixture = {
  /** Extension context passed to handlers under test. */
  readonly ctx: ExtensionContext;
  /** Last status text by status key. */
  readonly statuses: Map<string, string>;
  /** Notifications emitted through the mock UI. */
  readonly notifications: Notification[];
};

/**
 * Create mock ExtensionAPI that records registrations and custom entries.
 *
 * @returns mock API and captured registration state
 *
 * @example
 * ```typescript
 * const { api, shortcuts } = createMockApi();
 * ```
 */
function createMockApi(): {
  readonly api: ExtensionAPI;
  readonly registrations: RegistrationMap;
  readonly shortcuts: ShortcutMap;
  readonly entries: AppendedEntry[];
} {
  /** Event handlers registered through `pi.on`. */
  const registrations: RegistrationMap = new Map();
  /** Shortcuts registered through `pi.registerShortcut`. */
  const shortcuts: ShortcutMap = new Map();
  /** Custom entries appended through `pi.appendEntry`. */
  const entries: AppendedEntry[] = [];

  /** Minimal ExtensionAPI implementation for entry-point tests. */
  const api = {
    on(
      event: string,
      handler: HandlerFn,
    ) {
      const existing = registrations.get(event,)
        ?? [];
      existing.push(handler,);
      registrations.set(event, existing,);
    },
    registerTool() {},
    registerCommand() {},
    registerShortcut(
      shortcut: string,
      options: Record<string, unknown>,
    ) {
      shortcuts.set(shortcut, {
        handler: options.handler as HandlerFn,
        definition: options,
      },);
    },
    appendEntry(
      customType: string,
      data: unknown,
    ) {
      entries.push({ customType, data, },);
    },
  } as unknown as ExtensionAPI;

  return {
    api,
    registrations,
    shortcuts,
    entries,
  };
}

/**
 * Create mock ExtensionContext with captured status and notification calls.
 *
 * @param branch - active session branch exposed by `sessionManager.getBranch`
 *
 * @returns mock context fixture
 *
 * @example
 * ```typescript
 * const { ctx, statuses } = createMockContext({ branch: [] });
 * ```
 */
function createMockContext(
  {
    branch,
  }: {
    readonly branch: readonly SessionEntry[];
  },
): MockContextFixture {
  /** Status values keyed by status name. */
  const statuses = new Map<string, string>();
  /** Notifications emitted while the handler runs. */
  const notifications: Notification[] = [];

  /** Minimal ExtensionContext implementation for bypass tests. */
  const ctx = {
    cwd: '/repo',
    ui: {
      setStatus(
        key: string,
        text?: string,
      ) {
        if (text === undefined) {
          statuses.delete(key,);
          return;
        }
        statuses.set(key, text,);
      },
      notify(
        message: string,
        level?: string,
      ) {
        notifications.push({
          message,
          ...(level !== undefined ? { level, } : {}),
        },);
      },
      setWidget() {},
    },
    sessionManager: {
      getBranch() {
        return branch;
      },
    },
  } as unknown as ExtensionContext;

  return {
    ctx,
    statuses,
    notifications,
  };
}

/**
 * Retrieve a registered event handler.
 *
 * @param registrations - event handler registry from {@link createMockApi}
 * @param event - event name to retrieve
 *
 * @returns registered handler
 *
 * @throws when event was not registered
 *
 * @example
 * ```typescript
 * const handler = getHandler({ registrations, event: 'tool_call' });
 * ```
 */
function getHandler(
  {
    registrations,
    event,
  }: {
    readonly registrations: RegistrationMap;
    readonly event: string;
  },
): HandlerFn {
  /** Registered handlers for the requested event. */
  const handlers = registrations.get(event,);
  if ((handlers === undefined) || (handlers.length === 0))
    throw new Error(`No handler registered for event: ${event}`,);
  /** First handler, because auto-mode registers one handler per event in this file. */
  const [handler,] = handlers;
  if (handler === undefined)
    throw new Error(`No handler registered for event: ${event}`,);
  return handler;
}

/**
 * Retrieve registered bypass shortcut handler.
 *
 * @param shortcuts - shortcut registry from {@link createMockApi}
 *
 * @returns Shift+Tab bypass shortcut handler
 *
 * @throws when shortcut was not registered
 *
 * @example
 * ```typescript
 * const shortcut = getBypassShortcut({ shortcuts });
 * ```
 */
function getBypassShortcut(
  {
    shortcuts,
  }: {
    readonly shortcuts: ShortcutMap;
  },
): HandlerFn {
  /** Shortcut registration stored under the fixed bypass shortcut. */
  const shortcut = shortcuts.get(BYPASS_SHORTCUT,);
  if (shortcut === undefined)
    throw new Error('bypass shortcut not registered',);
  return shortcut.handler;
}

//endregion Mock infrastructure

/** Auto-mode entry point under test. */
const { default: autoMode, } = await import('./index.ts');

await describe({
  name: 'auto-mode bypass',
  children: [
    it({
      name: 'registers Shift+Tab shortcut',
      fn: async function registersShiftTabShortcut() {
        const { api, shortcuts, } = createMockApi();

        await autoMode(api,);

        expect(shortcuts.has(BYPASS_SHORTCUT,),).toBe(true,);
      },
    },),

    it({
      name: 'toggles visible status and audit entries',
      fn: async function togglesVisibleStatusAndAuditEntries() {
        const {
          api,
          shortcuts,
          entries,
        } = createMockApi();
        await autoMode(api,);
        const shortcut = getBypassShortcut({ shortcuts, },);
        const {
          ctx,
          statuses,
          notifications,
        } = createMockContext({ branch: [], },);

        await shortcut(ctx,);

        expect(statuses.get(BYPASS_STATUS_KEY,),).toBe(BYPASS_STATUS_TEXT,);
        expect(entries[0],).toEqual({
          customType: BYPASS_ENTRY_TYPE,
          data: {
            kind: BYPASS_TOGGLE_KIND,
            enabled: true,
            source: BYPASS_SOURCE_SHORTCUT,
          },
        },);
        expect(notifications[0],).toEqual({
          message:
            'Auto-mode bypass enabled: tool calls will run without judge checks.',
          level: 'warning',
        },);

        await shortcut(ctx,);

        expect(statuses.get(BYPASS_STATUS_KEY,),).toBeUndefined();
        expect(entries[1],).toEqual({
          customType: BYPASS_ENTRY_TYPE,
          data: {
            kind: BYPASS_TOGGLE_KIND,
            enabled: false,
            source: BYPASS_SOURCE_SHORTCUT,
          },
        },);
        expect(notifications[1],).toEqual({
          message: 'Auto-mode bypass disabled: guardrail checks restored.',
          level: 'info',
        },);
      },
    },),

    it({
      name: 'restores status from latest session toggle',
      fn: async function restoresStatusFromLatestSessionToggle() {
        const { api, registrations, } = createMockApi();
        await autoMode(api,);
        const sessionStart = getHandler({
          registrations,
          event: 'session_start',
        },);
        const { ctx, statuses, } = createMockContext({
          branch: [
            {
              type: 'custom',
              customType: BYPASS_ENTRY_TYPE,
              data: {
                kind: BYPASS_TOGGLE_KIND,
                enabled: false,
                source: BYPASS_SOURCE_SHORTCUT,
              },
            },
            {
              type: 'custom',
              customType: BYPASS_ENTRY_TYPE,
              data: {
                kind: BYPASS_TOGGLE_KIND,
                enabled: true,
                source: BYPASS_SOURCE_SHORTCUT,
              },
            },
          ],
        },);
        const {
          ctx: disabledCtx,
          statuses: disabledStatuses,
        } = createMockContext({
          branch: [
            {
              type: 'custom',
              customType: BYPASS_ENTRY_TYPE,
              data: {
                kind: BYPASS_TOGGLE_KIND,
                enabled: true,
                source: BYPASS_SOURCE_SHORTCUT,
              },
            },
            {
              type: 'custom',
              customType: BYPASS_ENTRY_TYPE,
              data: {
                kind: BYPASS_TOGGLE_KIND,
                enabled: false,
                source: BYPASS_SOURCE_SHORTCUT,
              },
            },
          ],
        },);

        sessionStart({ type: 'session_start', }, ctx,);
        sessionStart({ type: 'session_start', }, disabledCtx,);

        expect(statuses.get(BYPASS_STATUS_KEY,),).toBe(BYPASS_STATUS_TEXT,);
        expect(disabledStatuses.get(BYPASS_STATUS_KEY,),).toBeUndefined();
      },
    },),

    it({
      name: 'allows flagged tool calls without judge evaluation while enabled',
      fn: async function allowsFlaggedToolCallsWithoutJudgeEvaluationWhileEnabled() {
        const {
          api,
          registrations,
          shortcuts,
          entries,
        } = createMockApi();
        await autoMode(api,);
        const shortcut = getBypassShortcut({ shortcuts, },);
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);
        const { ctx, } = createMockContext({ branch: [], },);
        const event = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-env',
          input: {
            path: '/repo/.env',
          },
        } as unknown as ToolCallEvent;

        await shortcut(ctx,);
        const result = await toolCallHandler(event, ctx,);

        expect(result,).toBeUndefined();
        expect(entries[1],).toEqual({
          customType: BYPASS_ENTRY_TYPE,
          data: {
            kind: BYPASS_ALLOW_KIND,
            action: 'read /repo/.env',
            reason: BYPASS_ALLOW_REASON,
          },
        },);
      },
    },),
  ],
},);
