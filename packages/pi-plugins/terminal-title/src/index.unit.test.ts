/**
 * Tests for the extension entry point.
 *
 * Covers event handler registration and title setting via ctx.ui.setTitle().
 */

import type {
  AgentEndEvent,
  BeforeAgentStartEvent,
  ExtensionAPI,
  SessionShutdownEvent,
  SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  MAX_TERMINAL_TITLE_UTF8_BYTES,
  terminalTitleUtf8ByteLength,
} from '@monochromatic-dev/module-terminal-title/ts';

//region Mock infrastructure

/** Minimal handler signature matching pi event handlers. */
type HandlerFn = (...args: unknown[]) => unknown;

/** Shape of the mock registration map. */
type RegistrationMap = Map<string, HandlerFn[]>;

/**
 * Creates a mock ExtensionAPI that records all `on()` registrations.
 *
 * @returns mock API and the registration map for assertions
 */
function createMockApi() {
  const registrations: RegistrationMap = new Map();

  const api = {
    on(
      event: string,
      handler: HandlerFn,
    ) {
      const existing = registrations.get(event,) ?? [];
      existing.push(handler,);
      registrations.set(event, existing,);
    },
  } as unknown as ExtensionAPI;

  return {
    api,
    registrations,
  };
}

/**
 * Creates a mock context with a setTitle spy.
 *
 * @returns mock context and the titles array for assertions
 */
function createMockContext() {
  const titles: string[] = [];
  return {
    ctx: {
      ui: {
        setTitle(title: string,) {
          titles.push(title,);
        },
      },
    },
    titles,
  };
}

/**
 * Retrieves the registered handler for a given event.
 * Throws if no handler is registered for that event.
 *
 * @param registrations - the registration map from createMockApi
 *
 * @param event - event name to look up
 *
 * @returns the handler function
 */
function getHandler(
  {
    registrations,
    event,
  }: {
    registrations: RegistrationMap;
    event: string;
  },
): HandlerFn {
  const handlers = registrations.get(event,);
  if ((handlers === undefined) || (handlers.length === 0))
    throw new Error(`No handler registered for event: ${event}`,);
  const [handler,] = handlers;
  if (handler === undefined)
    throw new Error(`No handler registered for event: ${event}`,);
  return handler;
}

//endregion Mock infrastructure

// Dynamic import to get the default export
const { default: terminalTitle, } = await import('./index.ts');

await describe({
  name: terminalTitle.name,
  children: [
    //region Registration

    it({
      name: 'registers all six event handlers',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);

        const expectedEvents = [
          'tool_execution_start',
          'tool_execution_end',
          'session_start',
          'session_shutdown',
          'agent_end',
          'before_agent_start',
        ];

        for (const eventName of expectedEvents) {
          const handlers = registrations.get(eventName,);
          expect(handlers,).toBeDefined();
          expect(handlers,).toHaveLength(1,);
        }
      },
    },),

    //endregion Registration

    //region tool_execution_start handler

    it({
      name: 'sets title on tool_execution_start for bash',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'tool_execution_start', },);
        handler(
          { toolName: 'bash', args: { command: 'npm test', }, },
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(titles[0],).toBe('π npm test',);
      },
    },),

    it({
      name: 'byte-caps emitted tool_execution_start titles',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'tool_execution_start', },);
        handler(
          { toolName: 'bash', args: { command: '😀'.repeat(MAX_TERMINAL_TITLE_UTF8_BYTES,), }, },
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(terminalTitleUtf8ByteLength(titles[0] ?? '',),)
          .toBeLessThan(MAX_TERMINAL_TITLE_UTF8_BYTES + 1,);
      },
    },),

    //endregion tool_execution_start handler

    //region tool_execution_end handler

    it({
      name: 'sets title on tool_execution_end for read',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'tool_execution_end', },);
        handler(
          { toolName: 'read', result: {}, },
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(titles[0],).toBe('π Read file',);
      },
    },),

    it({
      name: 'reuses start args on tool_execution_end for bash',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const startHandler = getHandler({ registrations, event: 'tool_execution_start', },);
        const endHandler = getHandler({ registrations, event: 'tool_execution_end', },);
        startHandler(
          { toolCallId: 'call-1', toolName: 'bash', args: { command: 'ls -l', }, },
          ctx,
        );
        endHandler(
          { toolCallId: 'call-1', toolName: 'bash', result: {}, isError: false, },
          ctx,
        );

        expect(titles,).toStrictEqual([
          'π ls -l',
          'π ls -l',
        ],);
      },
    },),

    it({
      name: 'keeps out-of-order tool endings tied to call ids',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const startHandler = getHandler({ registrations, event: 'tool_execution_start', },);
        const endHandler = getHandler({ registrations, event: 'tool_execution_end', },);
        startHandler(
          { toolCallId: 'call-1', toolName: 'bash', args: { command: 'ls -l', }, },
          ctx,
        );
        startHandler(
          { toolCallId: 'call-2', toolName: 'bash', args: { command: 'pwd', }, },
          ctx,
        );
        endHandler(
          { toolCallId: 'call-2', toolName: 'bash', result: {}, isError: false, },
          ctx,
        );
        endHandler(
          { toolCallId: 'call-1', toolName: 'bash', result: {}, isError: false, },
          ctx,
        );

        expect(titles,).toStrictEqual([
          'π ls -l',
          'π pwd',
          'π pwd',
          'π ls -l',
        ],);
      },
    },),

    it({
      name: 'clears cached args on session shutdown',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const startHandler = getHandler({ registrations, event: 'tool_execution_start', },);
        const shutdownHandler = getHandler({ registrations, event: 'session_shutdown', },);
        const endHandler = getHandler({ registrations, event: 'tool_execution_end', },);
        startHandler(
          { toolCallId: 'call-1', toolName: 'bash', args: { command: 'ls -l', }, },
          ctx,
        );
        shutdownHandler(
          { type: 'session_shutdown', reason: 'quit', } as SessionShutdownEvent,
          ctx,
        );
        endHandler(
          { toolCallId: 'call-1', toolName: 'bash', result: {}, isError: false, },
          ctx,
        );

        expect(titles,).toStrictEqual([
          'π ls -l',
          'π Session ended',
          'π Ran command',
        ],);
      },
    },),

    //endregion tool_execution_end handler

    //region session_start handler

    it({
      name: 'sets title on session_start',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'session_start', },);
        handler(
          { type: 'session_start', reason: 'startup', } as SessionStartEvent,
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(titles[0],).toBe('π Session startup',);
      },
    },),

    //endregion session_start handler

    //region session_shutdown handler

    it({
      name: 'sets title on session_shutdown',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'session_shutdown', },);
        handler(
          { type: 'session_shutdown', reason: 'quit', } as SessionShutdownEvent,
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(titles[0],).toBe('π Session ended',);
      },
    },),

    //endregion session_shutdown handler

    //region agent_end handler

    it({
      name: 'sets title on agent_end',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'agent_end', },);
        handler(
          { type: 'agent_end', messages: [], } as AgentEndEvent,
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(titles[0],).toBe('π Stopped',);
      },
    },),

    //endregion agent_end handler

    //region before_agent_start handler

    it({
      name: 'sets title on before_agent_start with prompt',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'before_agent_start', },);
        handler(
          {
            type: 'before_agent_start',
            prompt: 'Fix the auth bug',
            systemPrompt: '',
            systemPromptOptions: {} as never,
          } as BeforeAgentStartEvent,
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(titles[0],).toBe('π Fix the auth bug',);
      },
    },),
    it({
      name: 'byte-caps emitted before_agent_start titles',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        terminalTitle(api,);
        const { ctx, titles, } = createMockContext();

        const handler = getHandler({ registrations, event: 'before_agent_start', },);
        handler(
          {
            type: 'before_agent_start',
            prompt: '😀'.repeat(MAX_TERMINAL_TITLE_UTF8_BYTES,),
            systemPrompt: '',
            systemPromptOptions: {} as never,
          } as BeforeAgentStartEvent,
          ctx,
        );

        expect(titles,).toHaveLength(1,);
        expect(terminalTitleUtf8ByteLength(titles[0] ?? '',),)
          .toBeLessThan(MAX_TERMINAL_TITLE_UTF8_BYTES + 1,);
      },
    },),
    //endregion before_agent_start handler
  ],
},);
