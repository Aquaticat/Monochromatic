/**
 * Disposable real-loader harness for Pi goal runtime verification.
 *
 * @module
 */

import {
  createEventBus,
  discoverAndLoadExtensions,
  type Extension,
  type ExtensionCommandContext,
  type ExtensionContext,
  type ExtensionRuntime,
  SessionManager,
} from '@earendil-works/pi-coding-agent';

//region Types

/** Generic loaded lifecycle callback driven by verifier. */
type RuntimeHandler = (
  event: unknown,
  context: ExtensionContext,
) => Promise<unknown> | unknown;

/** Generic loaded slash-command callback driven by verifier. */
type RuntimeCommand = (
  args: string,
  context: ExtensionCommandContext,
) => Promise<void> | void;

/** Generic loaded tool callback including Pi extension context. */
type RuntimeTool = (
  toolCallId: string,
  params: Readonly<Record<string, unknown>>,
  signal: AbortSignal | undefined,
  onUpdate: undefined,
  context: ExtensionContext,
) => Promise<{
  readonly content: readonly unknown[];
  readonly details: Readonly<Record<string, unknown>>;
  readonly terminate?: boolean;
}>;

/** Custom message and delivery metadata observed through real loader runtime. */
type CapturedRuntimeMessage = {
  readonly customType: string;
  readonly content: unknown;
  readonly triggerTurn: boolean;
};

/** Disposable package discovery result and stateful Pi boundaries. */
type GoalRuntimeHarness = {
  readonly extension: Extension;
  readonly runtime: ExtensionRuntime;
  readonly sessionManager: SessionManager;
  readonly context: ExtensionCommandContext;
  readonly messages: readonly CapturedRuntimeMessage[];
  readonly statuses: readonly string[];
  readonly notifications: readonly string[];
};

//endregion Types

//region Loader

/**
 * Bind stateful actions used by built goal extension after package discovery.
 *
 * @param runtime - real Pi extension runtime returned by package loader
 *
 * @param sessionManager - disposable persisted session owner
 *
 * @param messages - custom-message capture
 *
 * @mutates runtime - replaces uninitialized action stubs with disposable fixture adapters
 *
 * @mutates sessionManager - bound actions append custom state and visible messages
 *
 * @mutates messages - bound send action records delivery metadata
 *
 * @example
 * ```ts
 * bindRuntimeActions({ runtime, sessionManager, messages: [] });
 * ```
 */
function bindRuntimeActions(
  {
    runtime,
    sessionManager,
    messages,
  }: {
    readonly runtime: ExtensionRuntime;
    readonly sessionManager: SessionManager;
    readonly messages: CapturedRuntimeMessage[];
  },
): void {
  runtime.appendEntry = function appendDisposableEntry(customType, data,) {
    sessionManager.appendCustomEntry(customType, data,);
  };
  runtime.sendMessage = function sendDisposableMessage(message, options,) {
    messages.push({
      customType: message.customType,
      content: message.content,
      triggerTurn: options?.triggerTurn === true,
    },);
    sessionManager.appendCustomMessageEntry(
      message.customType,
      message.content,
      message.display,
      message.details,
    );
  };
}

/**
 * Discover package manifest through real Pi loader with disposable global state.
 *
 * @param packageDirectory - repository package directory containing manifest
 *
 * @param agentDirectory - empty disposable Pi agent directory
 *
 * @param sessionDirectory - disposable session-file directory
 *
 * @returns loaded extension and bound runtime harness
 *
 * @throws when Pi reports discovery errors or package count differs
 *
 * @example
 * ```ts
 * await createGoalRuntimeHarness({ packageDirectory: '.', agentDirectory, sessionDirectory });
 * ```
 */
async function createGoalRuntimeHarness(
  {
    packageDirectory,
    agentDirectory,
    sessionDirectory,
  }: {
    readonly packageDirectory: string;
    readonly agentDirectory: string;
    readonly sessionDirectory: string;
  },
): Promise<GoalRuntimeHarness> {
  /** Pi package discovery result using exact package directory. */
  const result = await discoverAndLoadExtensions(
    [packageDirectory,],
    packageDirectory,
    agentDirectory,
    createEventBus(),
  );
  if (result.errors.length > 0) {
    throw new Error(`Pi goal discovery failed: ${result.errors
      .map(function discoveryError(error,) {
        return error.error;
      },)
      .join('; ')}`,);
  }
  if (result.extensions.length !== 1)
    throw new Error(`expected one discovered goal extension, received ${result.extensions.length}`,);
  /** Sole package extension discovered from manifest. */
  const [extension,] = result.extensions;
  if (extension === undefined)
    throw new Error('Pi discovery returned no goal extension',);
  /** Real persisted session confined to disposable directory. */
  const sessionManager = SessionManager.create(
    packageDirectory,
    sessionDirectory,
  );
  /** Runtime-visible custom messages. */
  const messages: CapturedRuntimeMessage[] = [];
  /** Footer values in update order. */
  const statuses: string[] = [];
  /** UI notifications in update order. */
  const notifications: string[] = [];
  bindRuntimeActions({
    runtime: result.runtime,
    sessionManager,
    messages,
  },);
  /** Focused context for loaded command, lifecycle, and tool callbacks. */
  const context = {
    cwd: packageDirectory,
    mode: 'rpc',
    hasUI: false,
    ui: {
      setStatus(_key: string, text: string | undefined,) {
        statuses.push(text ?? 'CLEARED',);
      },
      notify(message: string,) {
        notifications.push(message,);
      },
    },
    sessionManager,
    model: undefined,
    isIdle() {
      return true;
    },
    hasPendingMessages() {
      return false;
    },
  } as unknown as ExtensionCommandContext;
  return {
    extension,
    runtime: result.runtime,
    sessionManager,
    context,
    messages,
    statuses,
    notifications,
  };
}

//endregion Loader

export { createGoalRuntimeHarness, };
export type {
  GoalRuntimeHarness,
  RuntimeCommand,
  RuntimeHandler,
  RuntimeTool,
};
