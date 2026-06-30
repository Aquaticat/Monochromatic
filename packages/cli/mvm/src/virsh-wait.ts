/**
 * VM lifecycle polling operations.
 *
 * Provides guest agent readiness checks and graceful shutdown
 * waiting logic for libvirt VMs.
 *
 * @module
 */

import { MS_PER_SECOND, } from '@monochromatic-dev/module-const/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { VM_PREFIX, } from './config.ts';
import { virsh, } from './virsh.ts';

/**
 * Logger root for mvm after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l, },);
 * ```
 */
const l = tagged({ tag: 'mvm', },);

/**
 * Milliseconds between guest agent ping attempts.
 */
const AGENT_POLL_INTERVAL_MS = MS_PER_SECOND;

/**
 * Default maximum milliseconds to wait for guest agent before giving up.
 */
const DEFAULT_AGENT_TIMEOUT_MS = 15_000;

/**
 * Milliseconds between VM state polls when waiting for shutdown.
 */
const SHUTDOWN_POLL_INTERVAL_MS = MS_PER_SECOND;

/**
 * Maximum milliseconds to wait for graceful shutdown.
 */
const SHUTDOWN_TIMEOUT_MS = 120_000;

/**
 * Polls the QEMU guest agent until it responds, indicating the VM has fully booted
 * and is ready to accept commands.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @param timeoutMs - Maximum milliseconds to wait (defaults to 15s)
 *
 * @throws Error when the guest agent does not respond within the timeout
 *
 * @example
 * ```ts
 * await waitForGuestAgent({ name: 'dev-01' });
 * await waitForGuestAgent({ name: 'template', timeoutMs: 120_000 });
 * ```
 */
export async function waitForGuestAgent({
  name,
  timeoutMs = DEFAULT_AGENT_TIMEOUT_MS,
}: {
  readonly name: string;
  readonly timeoutMs?: number;
},): Promise<void> {
  /**
   * Logger scoped to this call so retry logs are namespaced.
   */
  const rl = tagged({
    tag: waitForGuestAgent.name,
    l,
  },);
  /**
   * Prefixed libvirt domain name; what {@link virsh} expects on the wire.
   */
  const fullName = `${VM_PREFIX}${name}`;
  /**
   * Pre-serialised `guest-ping` payload; reused on every poll.
   */
  const pingPayload = JSON.stringify({ execute: 'guest-ping', },);
  /**
   * Wall-clock reference for the timeout check; epoch ms at entry.
   */
  const startTime = Date.now();

  rl.info(`waiting for guest agent on ${name}...`,);

  // oxlint-disable no-await-in-loop, promise/avoid-new -- polling loop
  while (true) {
    try {
      await virsh({ args: [
        'qemu-agent-command',
        fullName,
        pingPayload,
      ], },);
      rl.info(`guest agent on ${name} is ready`,);
      return;
    }
    catch (error) {
      if (!(Error.isError(error,)))
        throw error;

      /**
       * Milliseconds since polling began; compared against `timeoutMs` to give up.
       */
      const elapsed = Date.now()
        - startTime;
      if (elapsed >= timeoutMs) {
        throw new Error(
          `guest agent on ${name} did not respond within ${
            String(timeoutMs / MS_PER_SECOND,)
          }s`,
          { cause: error, },
        );
      }
      rl.debug(
        `guest agent not ready yet (${
          String(Math.round(elapsed / MS_PER_SECOND,),)
        }s elapsed), retrying...`,
      );
      await new Promise(function agentPollDelay(resolve,) {
        setTimeout(
          resolve,
          AGENT_POLL_INTERVAL_MS,
        );
      },);
    }
  }
  // oxlint-enable no-await-in-loop, promise/avoid-new
}

/**
 * Sends a graceful shutdown request to a VM via the guest agent.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @example
 * ```ts
 * await shutdownVm({ name: 'dev-01' });
 * ```
 */
export async function shutdownVm({ name, }: { readonly name: string; },): Promise<void> {
  /**
   * Logger scoped to this shutdown call so the diagnostic catch is namespaced.
   */
  const rl = tagged({
    tag: shutdownVm.name,
    l,
  },);
  /**
   * Prefixed libvirt domain name; what {@link virsh} expects on the wire.
   */
  const fullName = `${VM_PREFIX}${name}`;
  /**
   * Serialised `guest-shutdown` request; the response is ignored because the agent dies mid-shutdown.
   */
  const payload = JSON.stringify({ execute: 'guest-shutdown', },);
  try {
    await virsh({ args: [
      'qemu-agent-command',
      fullName,
      payload,
    ], },);
  }
  catch (error) {
    if (!(Error.isError(error,)))
      throw error;

    // Guest agent often disconnects before sending a response during shutdown.
    // This is expected behavior: the VM is shutting down.
    rl.debug('guest agent disconnected during shutdown (expected)',);
  }
}

/**
 * Polls VM state until it reaches "shut off", indicating graceful shutdown completed.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @throws Error when the VM does not shut down within the timeout
 *
 * @example
 * ```ts
 * await waitForShutdown({ name: 'dev-01' });
 * ```
 */
export async function waitForShutdown({ name, }: { readonly name: string; },): Promise<void> {
  /**
   * Logger scoped to this call so polling logs are namespaced.
   */
  const rl = tagged({
    tag: waitForShutdown.name,
    l,
  },);
  /**
   * Prefixed libvirt domain name; what `virsh domstate` expects on the wire.
   */
  const fullName = `${VM_PREFIX}${name}`;
  /**
   * Wall-clock reference for the timeout check; epoch ms at entry.
   */
  const startTime = Date.now();

  rl.info(`waiting for VM ${name} to shut down...`,);

  // oxlint-disable no-await-in-loop, promise/avoid-new -- polling loop
  while (true) {
    /**
     * Current libvirt domain state string; loop exits when it reaches `shut off`.
     */
    const state = await virsh({ args: [
      'domstate',
      fullName,
    ], },);
    if (state === 'shut off') {
      rl.info(`VM ${name} has shut down`,);
      return;
    }

    /**
     * Milliseconds since polling began; compared against the shutdown timeout to give up.
     */
    const elapsed = Date.now()
      - startTime;
    if (elapsed >= SHUTDOWN_TIMEOUT_MS) {
      throw new Error(
        `VM ${name} did not shut down within ${
          String(SHUTDOWN_TIMEOUT_MS / MS_PER_SECOND,)
        }s`,
      );
    }

    rl.debug(
      `VM state: ${state} (${String(Math.round(elapsed / MS_PER_SECOND,),)}s elapsed)`,
    );
    await new Promise(function shutdownPollDelay(resolve,) {
      setTimeout(
        resolve,
        SHUTDOWN_POLL_INTERVAL_MS,
      );
    },);
  }
  // oxlint-enable no-await-in-loop, promise/avoid-new
}
