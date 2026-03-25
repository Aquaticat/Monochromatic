/**
 * VM lifecycle polling operations.
 *
 * Provides guest agent readiness checks and graceful shutdown
 * waiting logic for libvirt VMs.
 *
 * @module
 */

import { VM_PREFIX, } from './config.ts';
import {
  l,
  tagged,
} from './log.ts';
import { virsh, } from './virsh.ts';

/** Milliseconds per second for converting between ms and seconds in log messages. */
const MS_PER_SECOND = 1_000;

/** Milliseconds between guest agent ping attempts. */
const AGENT_POLL_INTERVAL_MS = MS_PER_SECOND;

/** Default maximum milliseconds to wait for guest agent before giving up. */
const DEFAULT_AGENT_TIMEOUT_MS = 15_000;

/** Milliseconds between VM state polls when waiting for shutdown. */
const SHUTDOWN_POLL_INTERVAL_MS = MS_PER_SECOND;

/** Maximum milliseconds to wait for graceful shutdown. */
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
  name: string;
  timeoutMs?: number;
},): Promise<void> {
  const rl = tagged({
    tag: waitForGuestAgent.name,
    l,
  },);
  const fullName = `${VM_PREFIX}${name}`;
  const pingPayload = JSON.stringify({ execute: 'guest-ping', },);
  const startTime = Date.now();

  rl.info(`waiting for guest agent on ${name}...`,);

  // oxlint-disable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new -- polling loop
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
    catch {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new Error(
          `guest agent on ${name} did not respond within ${
            String(timeoutMs / MS_PER_SECOND,)
          }s`,
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
  // oxlint-enable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new
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
export async function shutdownVm({ name, }: { name: string; },): Promise<void> {
  const rl = tagged({
    tag: shutdownVm.name,
    l,
  },);
  const fullName = `${VM_PREFIX}${name}`;
  const payload = JSON.stringify({ execute: 'guest-shutdown', },);
  try {
    await virsh({ args: [
      'qemu-agent-command',
      fullName,
      payload,
    ], },);
  }
  catch {
    // Guest agent often disconnects before sending a response during shutdown.
    // This is expected behavior -- the VM is shutting down.
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
export async function waitForShutdown({ name, }: { name: string; },): Promise<void> {
  const rl = tagged({
    tag: waitForShutdown.name,
    l,
  },);
  const fullName = `${VM_PREFIX}${name}`;
  const startTime = Date.now();

  rl.info(`waiting for VM ${name} to shut down...`,);

  // oxlint-disable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new -- polling loop
  while (true) {
    const state = await virsh({ args: [
      'domstate',
      fullName,
    ], },);
    if (state === 'shut off') {
      rl.info(`VM ${name} has shut down`,);
      return;
    }

    const elapsed = Date.now() - startTime;
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
  // oxlint-enable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new
}
