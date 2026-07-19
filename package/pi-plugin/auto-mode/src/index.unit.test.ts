/**
 * Tests for the extension entry point.
 *
 * Covers event handler registration, /guard command behavior,
 * and propose_trust tool execution.
 */

import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import type { ExtensionAPI, ToolCallEvent, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { HISTORICAL_AGENT_TEMP_DIR, } from './constants.ts';
import { buildApprovalFingerprint, } from './tool-helpers.ts';
import {
  VERDICT_ENTRY_TYPE,
  type VerdictData,
} from './types.ts';

/** Private directory mode required before agent scratch roots are allowlisted. */
const PRIVATE_DIRECTORY_MODE = 0o700;

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

/** Shape of the mock shortcut map. */
type ShortcutMap = Map<string, {
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
  const shortcuts: ShortcutMap = new Map();
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
    tools,
    commands,
    shortcuts,
    entries,
  };
}

/**
 * Retrieves the registered handler for a given event.
 * Throws if no handler is registered.
 *
 * @returns the handler function
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

//endregion

// Dynamic import to get the default export
const { default: autoMode, } = await import('./index.ts');

await describe({
  name: autoMode.name,
  children: [
    //region Registration

    it({
      name: 'registers all seven event handlers',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        await autoMode(api,);

        const expectedEvents = [
          'session_start',
          'session_tree',
          'before_agent_start',
          'agent_start',
          'turn_start',
          'agent_end',
          'tool_call',
        ];

        for (const eventName of expectedEvents) {
          const handlers = registrations.get(eventName,);
          expect(handlers,).toBeDefined();
          expect(handlers,).toHaveLength(1,);
        }
      },
    },),

    //endregion

    //region Skill read allowlist

    it({
      name: 'allows read tool calls inside loaded skill directories',
      fn: async () => {
        const { api, registrations, } = createMockApi();
        await autoMode(api,);

        const beforeAgentStartHandler = getHandler({
          registrations,
          event: 'before_agent_start',
        },);
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        beforeAgentStartHandler({
          type: 'before_agent_start',
          prompt: '',
          systemPrompt: '',
          systemPromptOptions: {
            cwd: '/var/home/user/project',
            skills: [
              {
                name: 'testing-practices',
                description: 'Use when working with tests.',
                filePath:
                  '/var/home/user/Monochromatic/.agents/skills/testing-practices/SKILL.md',
                baseDir: '/var/home/user/Monochromatic/.agents/skills/testing-practices',
              },
            ],
          },
        },);

        const result = await toolCallHandler(
          {
            type: 'tool_call',
            toolName: 'read',
            toolCallId: 'read-skill',
            input: {
              path:
                '/var/home/user/Monochromatic/.agents/skills/testing-practices/SKILL.md',
            },
          },
          {
            cwd: '/var/home/user/project',
          },
        );

        expect(result,).toBeUndefined();
      },
    },),

    it({
      name: 'allows read tool calls inside historical compatibility directory',
      fn: async function allowsHistoricalAgentTempRead() {
        await mkdir(
          HISTORICAL_AGENT_TEMP_DIR,
          { recursive: true, },
        );
        await chmod(
          HISTORICAL_AGENT_TEMP_DIR,
          PRIVATE_DIRECTORY_MODE,
        );
        const tempRoot = await mkdtemp(join(
          HISTORICAL_AGENT_TEMP_DIR,
          'auto-mode-index-test-',
        ),);
        const tempFile = join(
          tempRoot,
          'source.ts',
        );
        await writeFile(
          tempFile,
          'export const source = true;\n',
        );

        const { api, registrations, } = createMockApi();
        await autoMode(api,);

        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        const result = await toolCallHandler(
          {
            type: 'tool_call',
            toolName: 'read',
            toolCallId: 'read-agent-temp',
            input: {
              path: tempFile,
            },
          },
          {
            cwd: '/var/home/user/project',
          },
        );

        expect(result,).toBeUndefined();
        await rm(
          tempRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    it({
      name: 'allows Bash credential handoff through historical compatibility root',
      fn: async function allowsHistoricalAgentTempBashCredentialHandoff() {
        await mkdir(
          HISTORICAL_AGENT_TEMP_DIR,
          { recursive: true, },
        );
        await chmod(
          HISTORICAL_AGENT_TEMP_DIR,
          PRIVATE_DIRECTORY_MODE,
        );
        const projectRoot = await mkdtemp(join(
          tmpdir(),
          'amode-index-project-',
        ),);
        const tempRoot = await mkdtemp(join(
          HISTORICAL_AGENT_TEMP_DIR,
          'amode-index-test-',
        ),);
        const envPath = join(
          projectRoot,
          '.env.local',
        );
        const scriptPath = join(
          tempRoot,
          'gemcheck.ts',
        );
        const imageGlob = join(
          tempRoot,
          'page-*.png',
        );
        await writeFile(
          envPath,
          'IMAGE_DIFF_GEMINI_API_KEY=test\n',
        );
        await writeFile(
          scriptPath,
          'export {};\n',
        );

        const { api, registrations, } = createMockApi();
        await autoMode(api,);

        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);

        const result = await toolCallHandler(
          {
            type: 'tool_call',
            toolName: 'bash',
            toolCallId: 'bash-agent-temp-credential',
            input: {
              command:
                `KEY=$(grep --max-count=1 IMAGE_DIFF_GEMINI_API_KEY ${envPath} | cut --delimiter='=' --fields=2- | tr --delete '"'); GEMINI_API_KEY="$KEY" node ${scriptPath} gemini-3.5-flash ${imageGlob}`,
            },
          },
          {
            cwd: projectRoot,
          },
        );

        expect(result,).toBeUndefined();
        await rm(
          projectRoot,
          {
            recursive: true,
            force: true,
          },
        );
        await rm(
          tempRoot,
          {
            recursive: true,
            force: true,
          },
        );
      },
    },),

    //endregion

    //region Approval reuse

    it({
      name: 'auto approves flagged action with prior session approval',
      fn: async function autoApprovesFlaggedActionWithPriorSessionApproval() {
        const {
          api,
          registrations,
          entries,
        } = createMockApi();
        await autoMode(api,);

        /** Registered tool-call handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);
        /** Repeated read tool event that should match prior session approval. */
        const event = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-env',
          input: {
            path: '/repo/.env',
          },
        } as unknown as ToolCallEvent;
        /** Exact fingerprint for the repeated read tool event. */
        const approvalFingerprint = buildApprovalFingerprint({
          event,
          cwd: '/repo',
        },);
        /** Guard result for repeated action, undefined means allowed by Pi. */
        const result = await toolCallHandler(
          event,
          {
            cwd: '/repo',
            ui: {
              setWidget() {},
            },
            sessionManager: {
              getBranch() {
                return [
                  {
                    type: 'custom',
                    customType: VERDICT_ENTRY_TYPE,
                    data: {
                      action: 'read /repo/.env',
                      approvalFingerprint,
                      verdict: 'user-approve',
                      reason: 'User approved dotenv read.',
                    } satisfies VerdictData,
                  },
                ];
              },
            },
          },
        );

        expect(result,).toBeUndefined();
        expect(entries,).toHaveLength(1,);
        expect(entries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read /repo/.env',
            approvalFingerprint,
            reusedFromVerdict: 'user-approve',
            verdict: 'approve',
            reason: 'User approved dotenv read.',
          },
        },);
      },
    },),

    it({
      name: 'auto approves flagged read with prior range approval',
      fn: async function autoApprovesFlaggedReadWithPriorRangeApproval() {
        const {
          api,
          registrations,
          entries,
        } = createMockApi();
        await autoMode(api,);

        /** Registered tool-call handler under test. */
        const toolCallHandler = getHandler({
          registrations,
          event: 'tool_call',
        },);
        /** Previously-approved read tool event for one file range. */
        const approvedEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-env-approved-range',
          input: {
            path: '/repo/.env',
            offset: 1,
            limit: 20,
          },
        } as unknown as ToolCallEvent;
        /** Repeated read tool event for another range in the same file. */
        const repeatedEvent = {
          type: 'tool_call',
          toolName: 'read',
          toolCallId: 'read-env-repeated-range',
          input: {
            path: '/repo/.env',
            offset: 21,
            limit: 20,
          },
        } as unknown as ToolCallEvent;
        /** Exact fingerprint for the approved read tool event. */
        const approvalFingerprint = buildApprovalFingerprint({
          event: approvedEvent,
          cwd: '/repo',
        },);
        /** Guard result for repeated action, undefined means allowed by Pi. */
        const result = await toolCallHandler(
          repeatedEvent,
          {
            cwd: '/repo',
            ui: {
              setWidget() {},
            },
            sessionManager: {
              getBranch() {
                return [
                  {
                    type: 'custom',
                    customType: VERDICT_ENTRY_TYPE,
                    data: {
                      action: 'read /repo/.env',
                      approvalFingerprint,
                      verdict: 'user-approve',
                      reason: 'User approved dotenv read.',
                    } satisfies VerdictData,
                  },
                ];
              },
            },
          },
        );

        expect(result,).toBeUndefined();
        expect(entries,).toHaveLength(1,);
        expect(entries[0],).toEqual({
          customType: VERDICT_ENTRY_TYPE,
          data: {
            action: 'read /repo/.env',
            approvalFingerprint,
            reusedFromVerdict: 'user-approve',
            verdict: 'approve',
            reason: 'User approved dotenv read.',
          },
        },);
      },
    },),

    //endregion

    //region /guard command

    it({
      name: 'registers /guard command',
      fn: async () => {
        const { api, commands, } = createMockApi();
        await autoMode(api,);

        expect(commands.has('guard',),).toBe(true,);
      },
    },),

    //endregion

    //region propose_trust tool

    it({
      name: 'registers propose_trust tool',
      fn: async () => {
        const { api, tools, } = createMockApi();
        await autoMode(api,);

        expect(tools.has('propose_trust',),).toBe(true,);
      },
    },),

    //endregion

    //region Entry persistence

    it({
      name: 'appendEntry is called for trust directives',
      fn: async () => {
        const { api, commands, entries, } = createMockApi();
        await autoMode(api,);

        const guardHandler = commands.get('guard',)?.handler;
        if (guardHandler === undefined)
          throw new Error('guard command not registered',);

        // Simulate adding a trust directive
        const mockCtx = {
          ui: { notify: () => {}, },
        };
        await guardHandler('Allow .env access', mockCtx,);

        expect(entries.length,).toBeGreaterThan(0,);
        const trustEntry = entries.find(
          e => e.customType === 'auto-mode:trust',
        );
        expect(trustEntry,).toBeDefined();
        expect(trustEntry?.data,).toBe('Allow .env access',);
      },
    },),

    it({
      name: 'appendEntry resets trust directives with null',
      fn: async () => {
        const { api, commands, entries, } = createMockApi();
        await autoMode(api,);

        const guardHandler = commands.get('guard',)?.handler;
        if (guardHandler === undefined)
          throw new Error('guard command not registered',);

        const mockCtx = {
          ui: { notify: () => {}, },
        };
        await guardHandler('reset', mockCtx,);

        const resetEntry = entries.find(
          e => (e.customType === 'auto-mode:trust') && (e.data === null),
        );
        expect(resetEntry,).toBeDefined();
      },
    },),
    //endregion
  ],
},);
