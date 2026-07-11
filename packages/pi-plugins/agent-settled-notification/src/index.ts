/**
 * Pi extension that tells KDE when an agent fully settles.
 *
 * @module
 */

import type { ExtensionAPI, } from '@earendil-works/pi-coding-agent';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import nanoSpawn from 'nano-spawn';

//region Constants

/** Executable implementing the local desktop-notification boundary. */
const NOTIFICATION_COMMAND = 'notify-send';

/** Limits notification delivery so a broken desktop session cannot hold up Pi's settled event. */
const NOTIFICATION_TIMEOUT_MS = 1_000;

/** Immutable desktop-notification payload that does not expose prompt, session, or project information. */
const NOTIFICATION_ARGUMENTS = [
  '--app-name=Pi',
  'Pi stopped',
  'Agent is idle and ready for input.',
] as const;

/** Root logger for this extension's notification lifecycle. */
const logger = tagged({ tag: 'pi-agent-settled-notification', },);

//endregion Constants

//region Notification boundary

/** Command and arguments passed to the desktop-notification executable. */
type NotificationInvocation = {
  /** Executable resolved through `PATH`. */
  readonly command: string;

  /** Fixed arguments kept outside shell syntax. */
  readonly args: readonly string[];
};

/** Injectable notification boundary used for deterministic delivery tests. */
type NotificationInvoker = (
  invocation: NotificationInvocation,
) => Promise<void>;

/**
 * Invokes the local desktop-notification executable without a shell.
 *
 * @param invocation - fixed command payload sent to the operating system
 *
 * @returns after the command accepts the notification or rejects on delivery failure
 *
 * @example
 * ```ts
 * await invokeNotification({
 *   command: 'notify-send',
 *   args: ['--app-name=Pi', 'Pi stopped', 'Agent is idle and ready for input.'],
 * });
 * ```
 */
async function invokeNotification(
  {
    command,
    args,
  }: NotificationInvocation,
): Promise<void> {
  await nanoSpawn(
    command,
    [...args,],
    {
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
      timeout: NOTIFICATION_TIMEOUT_MS,
    },
  );
}

/**
 * Delivers the settled-agent notification without allowing desktop failures to affect Pi.
 *
 * @param invoke - replacement delivery boundary for tests
 *
 * @returns after successful delivery or logged delivery failure
 *
 * @example
 * ```ts
 * await notifyAgentSettled({});
 * ```
 */
async function notifyAgentSettled(
  {
    invoke = invokeNotification,
  }: {
    readonly invoke?: NotificationInvoker;
  },
): Promise<void> {
  /** Per-delivery logger carrying the function boundary tag. */
  const innerLogger = tagged({
    tag: notifyAgentSettled.name,
    l: logger,
  },);

  innerLogger.debug('sending settled-agent desktop notification',);
  try {
    await invoke({
      command: NOTIFICATION_COMMAND,
      args: NOTIFICATION_ARGUMENTS,
    },);
    innerLogger.debug('sent settled-agent desktop notification',);
  }
  catch (error) {
    innerLogger.warn(
      `settled-agent desktop notification unavailable: ${Error.isError(error,) ? error.message : String(error,)}`,
    );
  }
}

//endregion Notification boundary

//region Extension registration

/** Registration inputs for the settled-agent notification event handler. */
type AgentSettledNotificationRegistration = {
  /** Pi extension API that owns lifecycle-event registration. */
  readonly pi: ExtensionAPI;

  /** Optional injectable notification boundary for deterministic tests. */
  readonly invoke?: NotificationInvoker;
};

/**
 * Registers the desktop-notification handler for final agent settlement only.
 *
 * @param registration - Pi API and optional test delivery boundary
 *
 * @returns after Pi has registered the sole lifecycle handler
 *
 * @example
 * ```ts
 * registerAgentSettledNotification({ pi });
 * ```
 */
function registerAgentSettledNotification(
  {
    pi,
    invoke,
  }: AgentSettledNotificationRegistration,
): void {
  pi.on(
    'agent_settled',
    async function handleAgentSettled() {
      await notifyAgentSettled({
        ...(invoke === undefined
          ? {}
          : { invoke, }),
      },);
    },
  );
}

/**
 * Registers the agent-settled desktop notification extension.
 *
 * @param pi - Pi extension API receiving the lifecycle subscription
 *
 * @example
 * ```ts
 * pi -e ./packages/pi-plugins/agent-settled-notification/src/index.ts
 * ```
 */
export default function agentSettledNotification(pi: ExtensionAPI,): void {
  registerAgentSettledNotification({ pi, },);
}

//endregion Extension registration

export {
  NOTIFICATION_ARGUMENTS,
  NOTIFICATION_COMMAND,
  NOTIFICATION_TIMEOUT_MS,
  notifyAgentSettled,
  registerAgentSettledNotification,
};

export type {
  NotificationInvocation,
  NotificationInvoker,
};
