/**
 * Tests for the extension entry point.
 *
 * Covers event handler registration, /guard command behavior,
 * and propose_trust tool execution.
 */

import type { ExtensionAPI, } from "@earendil-works/pi-coding-agent";
import {
  describe,
  expect,
  it,
} from "@monochromatic-dev/module-test";

//region Mock infrastructure

/** Minimal handler signature matching pi event handlers. */
type HandlerFn = (...args: unknown[]) => unknown;

/** Shape of the mock registration map. */
type RegistrationMap = Map<string, HandlerFn[]>;

/** Shape of the mock tool map. */
type ToolMap = Map<string, {
  handler: HandlerFn;
  definition: unknown;
}>;

/** Shape of the mock command map. */
type CommandMap = Map<string, {
  handler: HandlerFn;
  definition: unknown;
}>;

/** Custom entry appended via pi.appendEntry. */
type AppendedEntry = {
  customType: string;
  data: unknown;
};

/**
 * Creates a mock ExtensionAPI that records all registrations.
 *
 * @returns mock API and tracking structures for assertions
 */
function createMockApi() {
  const registrations: RegistrationMap = new Map();
  const tools: ToolMap = new Map();
  const commands: CommandMap = new Map();
  const entries: AppendedEntry[] = [];

  const api = {
    on(
      event: string,
      handler: HandlerFn,
    ) {
      const existing = registrations.get(event,) ?? [];
      existing.push(handler,);
      registrations.set(event, existing,);
    },
    registerTool(
      definition: Record<string, unknown>,
    ) {
      const name = definition.name as string;
      tools.set(name, {
        handler: definition.execute as HandlerFn,
        definition,
      },);
    },
    registerCommand(
      name: string,
      options: Record<string, unknown>,
    ) {
      commands.set(name, {
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
    tools,
    commands,
    entries,
  };
}

/**
 * Retrieves the registered handler for a given event.
 * Throws if no handler is registered.
 *
 * @param registrations - the registration map
 *
 * @param event - event name to look up
 *
 * @returns the handler function
 */
function getHandler(
  registrations: RegistrationMap,
  event: string,
): HandlerFn {
  const handlers = registrations.get(event,);
  if (handlers === undefined || handlers.length === 0) {
    throw new Error(`No handler registered for event: ${event}`,);
  }
  const [handler,] = handlers;
  if (handler === undefined) {
    throw new Error(`No handler registered for event: ${event}`,);
  }
  return handler;
}

//endregion

// Dynamic import to get the default export
const { default: autoMode, } = await import("./index.ts",);

await describe({
  name: autoMode.name,
  children: [
    //region Registration

    it({
      name: "registers all four event handlers",
      fn: async () => {
        const { api, registrations, } = createMockApi();
        autoMode(api,);

        const expectedEvents = [
          "agent_start",
          "turn_start",
          "agent_end",
          "tool_call",
        ];

        for (const eventName of expectedEvents) {
          const handlers = registrations.get(eventName,);
          expect(handlers,).toBeDefined();
          expect(handlers,).toHaveLength(1,);
        }
      },
    },),

    //endregion

    //region /guard command

    it({
      name: "registers /guard command",
      fn: async () => {
        const { api, commands, } = createMockApi();
        autoMode(api,);

        expect(commands.has("guard",),).toBe(true,);
      },
    },),

    //endregion

    //region propose_trust tool

    it({
      name: "registers propose_trust tool",
      fn: async () => {
        const { api, tools, } = createMockApi();
        autoMode(api,);

        expect(tools.has("propose_trust",),).toBe(true,);
      },
    },),

    //endregion

    //region Entry persistence

    it({
      name: "appendEntry is called for trust directives",
      fn: async () => {
        const { api, commands, entries, } = createMockApi();
        autoMode(api,);

        const guardHandler = commands.get("guard",)?.handler;
        if (guardHandler === undefined) {
          throw new Error("guard command not registered",);
        }

        // Simulate adding a trust directive
        const mockCtx = {
          ui: { notify: () => {} },
        };
        await guardHandler("Allow .env access", mockCtx,);

        expect(entries.length,).toBeGreaterThan(0,);
        const trustEntry = entries.find(
          (e) => e.customType === "auto-mode:trust",
        );
        expect(trustEntry,).toBeDefined();
        expect(trustEntry?.data,).toBe("Allow .env access",);
      },
    },),

    it({
      name: "appendEntry resets trust directives with null",
      fn: async () => {
        const { api, commands, entries, } = createMockApi();
        autoMode(api,);

        const guardHandler = commands.get("guard",)?.handler;
        if (guardHandler === undefined) {
          throw new Error("guard command not registered",);
        }

        const mockCtx = {
          ui: { notify: () => {} },
        };
        await guardHandler("reset", mockCtx,);

        const resetEntry = entries.find(
          (e) => e.customType === "auto-mode:trust" && e.data === null,
        );
        expect(resetEntry,).toBeDefined();
      },
    },),

    //endregion
  ],
},);
