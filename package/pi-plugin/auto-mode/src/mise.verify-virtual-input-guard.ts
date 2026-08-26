/**
 * Verify built auto-mode virtual-input guard through real Pi AgentSession.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  type Api,
  type AssistantMessage,
  type AssistantMessageEventStream,
  type Context,
  createAssistantMessageEventStream,
  type Model,
  type ToolCall,
} from '@earendil-works/pi-ai';
import {
  type AgentToolResult,
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionFactory,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { Type, } from 'typebox';

/** Built extension loaded by real Pi resource discovery. */
const BUILT_EXTENSION_PATH = '../dist/final/node/index.mjs';

/** Scripted provider identity. */
const PROVIDER_ID = 'auto-mode-virtual-input-verifier';

/** Scripted model identity. */
const MODEL_ID = 'ydotool-hard-block';

/** Exact fake Bash command emitted by scripted provider. */
const YDOTOOL_COMMAND = 'ydotool key 1:1 1:0';

/** Expected hard-block text emitted by built extension. */
const EXPECTED_REASON_FRAGMENT = 'Direct ydotool invocation is blocked';

/** Fake Bash execution details used only if guard regresses. */
type FakeBashDetails = {
  readonly executed: true;
};

/**
 * Create provider-owned assistant result.
 *
 * @param model - Registered scripted model.
 *
 * @param stopReason - Terminal reason for current provider response.
 *
 * @returns Mutable assistant output consumed by event stream.
 */
function createOutput(
  {
    model,
    stopReason,
  }: {
    readonly model: Model<Api>;
    readonly stopReason: AssistantMessage['stopReason'];
  },
): AssistantMessage {
  return {
    role: 'assistant',
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
    },
    stopReason,
    timestamp: Date.now(),
  };
}

/**
 * Emit one Bash tool call requesting unsafe ydotool command.
 *
 * @param model - Registered scripted model.
 *
 * @returns Closed tool-use event stream.
 */
function toolCallStream(model: Model<Api>,): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const output = createOutput({ model, stopReason: 'toolUse', },);
  const toolCall: ToolCall = {
    type: 'toolCall',
    id: 'virtual-input-guard-runtime-call',
    name: 'bash',
    arguments: { command: YDOTOOL_COMMAND, },
  };
  output.content.push(toolCall,);
  stream.push({ type: 'start', partial: output, },);
  stream.push({ type: 'toolcall_start', contentIndex: 0, partial: output, },);
  stream.push({ type: 'toolcall_end', contentIndex: 0, toolCall, partial: output, },);
  stream.push({ type: 'done', reason: 'toolUse', message: output, },);
  stream.end();
  return stream;
}

/**
 * Emit final text so real agent loop settles after blocked tool result.
 *
 * @param model - Registered scripted model.
 *
 * @returns Closed text event stream.
 */
function finalTextStream(model: Model<Api>,): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream();
  const output = createOutput({ model, stopReason: 'stop', },);
  const text = {
    type: 'text' as const,
    text: 'scripted verifier complete',
  };
  output.content.push(text,);
  stream.push({ type: 'start', partial: output, },);
  stream.push({ type: 'text_start', contentIndex: 0, partial: output, },);
  stream.push({ type: 'text_delta', contentIndex: 0, delta: text.text, partial: output, },);
  stream.push({ type: 'text_end', contentIndex: 0, content: text.text, partial: output, },);
  stream.push({ type: 'done', reason: 'stop', message: output, },);
  stream.end();
  return stream;
}

/**
 * Register deterministic local provider in disposable model runtime.
 *
 * @param modelRuntime - Isolated Pi model registry.
 *
 * @param invocations - Caller-owned provider-call capture.
 *
 * @returns Registered scripted model.
 *
 * @mutates modelRuntime - Registers local provider and model.
 *
 * @mutates invocations - Stream callback records each provider call.
 */
function registerScriptedProvider(
  {
    modelRuntime,
    invocations,
  }: {
    readonly modelRuntime: ModelRuntime;
    readonly invocations: true[];
  },
): Model<Api> {
  modelRuntime.registerProvider(PROVIDER_ID, {
    name: 'Auto-mode virtual input verifier',
    baseUrl: 'https://auto-mode-verifier.invalid',
    apiKey: 'disposable-verifier-key',
    api: PROVIDER_ID,
    models: [{
      id: MODEL_ID,
      name: 'ydotool hard block',
      reasoning: false,
      input: ['text',],
      cost: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
      },
      contextWindow: 16_384,
      maxTokens: 4_096,
    },],
    streamSimple(
      model: Model<Api>,
      _context: Context,
    ): AssistantMessageEventStream {
      invocations.push(true,);
      if (invocations.length === 1)
        return toolCallStream(model,);
      return finalTextStream(model,);
    },
  },);
  const model = modelRuntime.getModel(PROVIDER_ID, MODEL_ID,);
  if (model === undefined)
    throw new Error('scripted virtual-input verifier model registration failed',);
  return model;
}

/**
 * Create fake Bash extension that records any execution without running shell.
 *
 * @param executions - Caller-owned command capture.
 *
 * @returns Extension factory overriding Bash execution boundary.
 *
 * @mutates executions - Fake Bash callback records command when guard fails.
 */
function fakeBashFactory(executions: string[],): ExtensionFactory {
  return function registerFakeBash(pi,): void {
    pi.registerTool({
      name: 'bash',
      label: 'Fake Bash',
      description: 'Disposable Bash boundary for virtual-input guard verification',
      parameters: Type.Object({ command: Type.String(), }),
      // oxlint-disable-next-line typescript/require-await, eslint/require-await -- Pi tool contract is asynchronous while fixture is synchronous.
      async execute(
        _toolCallId,
        params: Readonly<{ command: string; }>,
      ): Promise<AgentToolResult<FakeBashDetails>> {
        executions.push(params.command,);
        return {
          content: [{ type: 'text', text: 'FAKE_BASH_EXECUTED', },],
          details: { executed: true, },
        };
      },
    },);
  };
}

/**
 * Verify built extension blocks unsafe command before fake Bash callback.
 *
 * @returns Successful verification diagnostic.
 *
 * @throws When extension load, guard result, provider sequence, or execution differs.
 */
async function verifyVirtualInputGuard(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'auto-mode-virtual-input-',),);
  await using cleanup = {
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(root, { recursive: true, force: true, },);
    },
  };
  void cleanup;
  const agentDirectory = join(root, 'agent',);
  const workspaceDirectory = join(root, 'workspace',);
  const sessionDirectory = join(root, 'session',);
  await Promise.all([
    mkdir(agentDirectory,),
    mkdir(workspaceDirectory,),
    mkdir(sessionDirectory,),
  ],);

  const executions: string[] = [];
  const invocations: true[] = [];
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false, },
    retry: {
      enabled: false,
      provider: { maxRetries: 0, },
    },
  },);
  const resourceLoader = new DefaultResourceLoader({
    cwd: workspaceDirectory,
    agentDir: agentDirectory,
    settingsManager,
    additionalExtensionPaths: [BUILT_EXTENSION_PATH,],
    extensionFactories: [fakeBashFactory(executions,),],
  },);
  await resourceLoader.reload();
  const modelRuntime = await ModelRuntime.create({
    authPath: join(agentDirectory, 'auth.json',),
    modelsPath: join(agentDirectory, 'models.json',),
  },);
  const model = registerScriptedProvider({ modelRuntime, invocations, },);
  const sessionManager = SessionManager.create(workspaceDirectory, sessionDirectory,);
  const {
    session,
    extensionsResult,
  } = await createAgentSession({
    cwd: workspaceDirectory,
    agentDir: agentDirectory,
    model,
    tools: ['bash',],
    resourceLoader,
    modelRuntime,
    settingsManager,
    sessionManager,
  },);
  using sessionOwner = {
    [Symbol.dispose](): void {
      session.dispose();
    },
  };
  void sessionOwner;
  if (extensionsResult.errors.length > 0)
    throw new Error(`AgentSession extension errors: ${JSON.stringify(extensionsResult.errors,)}`,);

  await session.prompt('Run scripted virtual-input guard verification.',);
  await session.waitForIdle();
  if (executions.length > 0)
    throw new Error(`fake Bash executed blocked commands: ${executions.join(', ')}`,);
  if (invocations.length !== 2)
    throw new Error(`expected two scripted provider calls, received ${invocations.length}`,);
  const branchText = JSON.stringify(sessionManager.getBranch(),);
  if (!branchText.includes(EXPECTED_REASON_FRAGMENT,))
    throw new Error('blocked tool result omitted virtual-input guard reason',);
  return 'auto-mode virtual-input guard verified: real AgentSession blocked ydotool before fake Bash';
}

console.log(await verifyVirtualInputGuard(),);
