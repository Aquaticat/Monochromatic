/**
 * Real AgentSession ordinary-tool regression for Pi goal extension.
 *
 * @module
 */

import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  createAgentSession,
  DefaultResourceLoader,
  defineTool,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { Type, } from 'typebox';

/** Agent-bound tool surface required by regression driver. */
type ExecutableTool = {
  readonly execute: (
    callId: string,
    params: Readonly<Record<string, unknown>>,
    signal?: AbortSignal,
  ) => Promise<{
    readonly content: readonly unknown[];
  }>;
};

/** Agent session surface required to retrieve wrapped tools. */
type ToolSession = {
  readonly agent: {
    readonly state: {
      readonly tools: readonly ({ readonly name: string; } & ExecutableTool)[];
    };
  };
};

/**
 * Retrieve wrapped tool by runtime name.
 *
 * @param session - real Pi agent session
 *
 * @param name - selected built-in or custom tool
 *
 * @returns executable wrapped tool
 *
 * @throws when selected tool is absent
 *
 * @example
 * ```ts
 * requiredTool(session, 'read');
 * ```
 */
function requiredTool(
  session: ToolSession,
  name: string,
): ExecutableTool {
  /** Tool selected from real AgentSession state after extension binding. */
  const tool = session.agent.state.tools.find(function matchesName(candidate,) {
    return candidate.name === name;
  },);
  if (tool === undefined)
    throw new Error(`real AgentSession lacks tool: ${name}`,);
  return tool;
}

/**
 * Execute one wrapped tool with fresh call identity.
 *
 * @param session - real AgentSession containing wrapped tool
 *
 * @param name - selected tool name
 *
 * @param params - tool-specific arguments
 *
 * @returns final tool result
 *
 * @example
 * ```ts
 * await executeTool({ session, name: 'bash', params: { command: 'pwd' } });
 * ```
 */
async function executeTool(
  {
    session,
    name,
    params,
  }: {
    readonly session: ToolSession;
    readonly name: string;
    readonly params: Readonly<Record<string, unknown>>;
  },
): Promise<{ readonly content: readonly unknown[]; }> {
  return await requiredTool(
    session,
    name,
  ).execute(
    `verify-${name}`,
    params,
    new AbortController().signal,
  );
}

/**
 * Exercise built-in and custom tools after abort boundary with goal extension loaded.
 *
 * @param packageDirectory - repository-owned goal package directory
 *
 * @param agentDirectory - disposable global Pi directory
 *
 * @param workspaceDirectory - disposable tool filesystem
 *
 * @param sessionDirectory - disposable persisted sessions
 *
 * @returns successful tool names in execution order
 *
 * @throws when extension loading, tool execution, or filesystem effects differ
 *
 * @example
 * ```ts
 * await verifyOrdinaryToolsAfterAbort({ packageDirectory, agentDirectory, workspaceDirectory, sessionDirectory });
 * ```
 */
async function verifyOrdinaryToolsAfterAbort(
  {
    packageDirectory,
    agentDirectory,
    workspaceDirectory,
    sessionDirectory,
  }: {
    readonly packageDirectory: string;
    readonly agentDirectory: string;
    readonly workspaceDirectory: string;
    readonly sessionDirectory: string;
  },
): Promise<readonly string[]> {
  await Promise.all([
    writeFile(join(workspaceDirectory, 'read.txt',), 'readable fixture',),
    writeFile(join(workspaceDirectory, 'edit.txt',), 'before edit',),
  ],);
  /** In-memory settings exclude real global and project configuration. */
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false, },
  },);
  /** Loader uses built extension artifact plus harmless custom tool. */
  const resourceLoader = new DefaultResourceLoader({
    cwd: workspaceDirectory,
    agentDir: agentDirectory,
    settingsManager,
    additionalExtensionPaths: [join(packageDirectory, 'dist/final/node/index.mjs',),],
    extensionFactories: [
      function registerVerificationEcho(pi,) {
        pi.registerTool({
          name: 'verification_echo',
          label: 'Verification Echo',
          description: 'Return supplied disposable verification value',
          parameters: Type.Object({ value: Type.String(), }),
          // oxlint-disable-next-line typescript/require-await -- Pi tool contract is asynchronous while fixture computation is synchronous.
          async execute(_callId, params,) {
            return {
              content: [{ type: 'text' as const, text: params.value, },],
              details: {},
            };
          },
        },);
      },
    ],
  },);
  await resourceLoader.reload();
  /** Model registry isolated from real credentials and custom model files. */
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDirectory, 'auth.json',),
    modelsPath: join(agentDirectory, 'models.json',),
  },);
  /** Real AgentSession owns wrapped built-in and custom tools. */
  const { session, extensionsResult, } = await createAgentSession({
    cwd: workspaceDirectory,
    agentDir: agentDirectory,
    tools: ['read', 'bash', 'edit', 'write', 'verification_echo',],
    resourceLoader,
    modelRuntime,
    settingsManager,
    sessionManager: SessionManager.create(workspaceDirectory, sessionDirectory,),
  },);
  if (extensionsResult.errors.length > 0)
    throw new Error(`AgentSession extension errors: ${JSON.stringify(extensionsResult.errors,)}`,);
  await session.abort();
  await executeTool({ session, name: 'read', params: { path: 'read.txt', }, },);
  await executeTool({ session, name: 'bash', params: { command: 'pwd', }, },);
  await executeTool({
    session,
    name: 'edit',
    params: {
      path: 'edit.txt',
      edits: [{
        oldText: 'before edit',
        newText: 'after edit',
      },],
    },
  },);
  await executeTool({
    session,
    name: 'write',
    params: { path: 'write.txt', content: 'write completed', },
  },);
  /** Custom-tool output verifies extension tool wrapper remained executable. */
  const customResult = await executeTool({
    session,
    name: 'verification_echo',
    params: { value: 'custom completed', },
  },);
  if (!JSON.stringify(customResult.content,).includes('custom completed',))
    throw new Error('custom tool result did not cross AgentSession wrapper',);
  /** Final edited fixture content. */
  const edited = await readFile(join(workspaceDirectory, 'edit.txt',), 'utf8',);
  /** Final written fixture content. */
  const written = await readFile(join(workspaceDirectory, 'write.txt',), 'utf8',);
  session.dispose();
  if ((edited !== 'after edit') || (written !== 'write completed'))
    throw new Error('edit or write tool did not mutate disposable fixture as expected',);
  return ['read', 'bash', 'edit', 'write', 'verification_echo',];
}

export { verifyOrdinaryToolsAfterAbort, };
