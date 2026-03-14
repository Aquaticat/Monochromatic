import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LIBVIRT_URI, VM_PREFIX } from './config.ts';
import { l, tagged } from './log.ts';
import { spawn } from './spawn.ts';

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
 * Runs a virsh command against the system QEMU/KVM connection.
 *
 * @param args - Array of command-line arguments for virsh
 *
 * @returns Trimmed stdout output
 *
 * @throws Error when virsh exits with non-zero code
 *
 * @example
 * ```ts
 * const output = await virsh({ args: ['list', '--all'] });
 * ```
 */
export function virsh({ args }: { args: readonly string[] }): Promise<string> {
  return spawn({ command: 'virsh', args: ['--connect', LIBVIRT_URI, ...args], });
}

/**
 * Defines a VM in libvirt from an XML string.
 * Writes the XML to a file in the VM directory, then calls `virsh define`.
 *
 * @param vmDir - Directory to write the XML file into
 *
 * @param xml - XML content for the domain definition
 *
 * @returns Resolves when the VM is defined
 */
export async function defineVm({ vmDir, xml }: { vmDir: string; xml: string }): Promise<void> {
  const xmlPath = join(vmDir, 'domain.xml');
  await writeFile(xmlPath, xml);
  await virsh({ args: ['define', xmlPath], });
}

/**
 * Starts a defined VM.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns Resolves when the VM is started
 */
export async function startVm({ name }: { name: string }): Promise<void> {
  await virsh({ args: ['start', `${VM_PREFIX}${name}`], });
}

/**
 * Force-stops a running VM (equivalent to pulling the power cord).
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns Resolves when the VM is force-stopped
 */
export async function destroyVm({ name }: { name: string }): Promise<void> {
  await virsh({ args: ['destroy', `${VM_PREFIX}${name}`], });
}

/**
 * Removes a VM definition and deletes all associated storage volumes.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns Resolves when the VM is undefined
 */
export async function undefineVm({ name }: { name: string }): Promise<void> {
  await virsh({ args: ['undefine', `${VM_PREFIX}${name}`, '--remove-all-storage'], });
}

/**
 * Polls the QEMU guest agent until it responds, indicating the VM has fully booted
 * and is ready to accept commands.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @param timeoutMs - Maximum milliseconds to wait (defaults to 15s)
 *
 * @returns Resolves when the guest agent responds
 *
 * @throws Error when the guest agent does not respond within the timeout
 *
 * @example
 * ```ts
 * await waitForGuestAgent({ name: 'dev-01' });
 * await waitForGuestAgent({ name: 'template', timeoutMs: 120_000 });
 * ```
 */
export async function waitForGuestAgent({ name, timeoutMs = DEFAULT_AGENT_TIMEOUT_MS }: {
  name: string;
  timeoutMs?: number;
}): Promise<void> {
  const rl = tagged({ tag: waitForGuestAgent.name, l });
  const fullName = `${VM_PREFIX}${name}`;
  const pingPayload = JSON.stringify({ execute: 'guest-ping' });
  const startTime = Date.now();

  rl.info(`waiting for guest agent on ${name}...`);

  // oxlint-disable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new -- polling loop
  while (true) {
    try {
      await virsh({ args: ['qemu-agent-command', fullName, pingPayload] });
      rl.info(`guest agent on ${name} is ready`);
      return;
    } catch {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new Error(
          `guest agent on ${name} did not respond within ${String(timeoutMs / MS_PER_SECOND)}s`,
        );
      }
      rl.debug(`guest agent not ready yet (${String(Math.round(elapsed / MS_PER_SECOND))}s elapsed), retrying...`);
      await new Promise(function agentPollDelay(resolve) { setTimeout(resolve, AGENT_POLL_INTERVAL_MS); });
    }
  }
  // oxlint-enable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new
}

/**
 * Sends a graceful shutdown request to a VM via the guest agent.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns Resolves after sending the shutdown command
 *
 * @example
 * ```ts
 * await shutdownVm({ name: 'dev-01' });
 * ```
 */
export async function shutdownVm({ name }: { name: string }): Promise<void> {
  const rl = tagged({ tag: shutdownVm.name, l });
  const fullName = `${VM_PREFIX}${name}`;
  const payload = JSON.stringify({ execute: 'guest-shutdown' });
  try {
    await virsh({ args: ['qemu-agent-command', fullName, payload] });
  } catch {
    // Guest agent often disconnects before sending a response during shutdown.
    // This is expected behavior -- the VM is shutting down.
    rl.debug('guest agent disconnected during shutdown (expected)');
  }
}

/**
 * Polls VM state until it reaches "shut off", indicating graceful shutdown completed.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns Resolves when the VM reaches "shut off" state
 *
 * @throws Error when the VM does not shut down within the timeout
 *
 * @example
 * ```ts
 * await waitForShutdown({ name: 'dev-01' });
 * ```
 */
export async function waitForShutdown({ name }: { name: string }): Promise<void> {
  const rl = tagged({ tag: waitForShutdown.name, l });
  const fullName = `${VM_PREFIX}${name}`;
  const startTime = Date.now();

  rl.info(`waiting for VM ${name} to shut down...`);

  // oxlint-disable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new -- polling loop
  while (true) {
    const state = await virsh({ args: ['domstate', fullName] });
    if (state === 'shut off') {
      rl.info(`VM ${name} has shut down`);
      return;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= SHUTDOWN_TIMEOUT_MS) {
      throw new Error(
        `VM ${name} did not shut down within ${String(SHUTDOWN_TIMEOUT_MS / MS_PER_SECOND)}s`,
      );
    }

    rl.debug(`VM state: ${state} (${String(Math.round(elapsed / MS_PER_SECOND))}s elapsed)`);
    await new Promise(function shutdownPollDelay(resolve) { setTimeout(resolve, SHUTDOWN_POLL_INTERVAL_MS); });
  }
  // oxlint-enable typescript/no-unnecessary-condition, no-await-in-loop, promise/avoid-new
}

/**
 * Lists all VMs managed by this tool (those with the `mvm-` prefix).
 *
 * @returns Array of VM names without the prefix
 */
export async function listVms(): Promise<readonly string[]> {
  const output = await virsh({ args: ['list', '--all', '--name'], });
  return output
    .split('\n')
    .filter(function startsWithPrefix(line) { return line.startsWith(VM_PREFIX); })
    .map(function stripPrefix(line) { return line.slice(VM_PREFIX.length); });
}

