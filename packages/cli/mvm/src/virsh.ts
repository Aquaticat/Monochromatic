import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LIBVIRT_URI, VM_PREFIX } from './config.ts';
import { l, tagged } from './log.ts';
import { run } from './run.ts';

/** Milliseconds between guest agent ping attempts. */
const AGENT_POLL_INTERVAL_MS = 1000;

/** Default maximum milliseconds to wait for guest agent before giving up. */
const DEFAULT_AGENT_TIMEOUT_MS = 15_000;

/** Milliseconds between VM state polls when waiting for shutdown. */
const SHUTDOWN_POLL_INTERVAL_MS = 1000;

/** Maximum milliseconds to wait for graceful shutdown. */
const SHUTDOWN_TIMEOUT_MS = 120_000;

/**
 * Runs a virsh command against the system QEMU/KVM connection.
 *
 * @param options - Arguments array passed directly to virsh
 * @returns Trimmed stdout output
 * @throws Error when virsh exits with non-zero code
 *
 * @example
 * ```ts
 * const output = await virsh({ args: ['list', '--all'] });
 * ```
 */
export async function virsh({ args }: { args: ReadonlyArray<string> }): Promise<string> {
  return run({ command: 'virsh', args: ['--connect', LIBVIRT_URI, ...args], });
}

/**
 * Defines a VM in libvirt from an XML string.
 * Writes the XML to a file in the VM directory, then calls `virsh define`.
 *
 * @param options - VM directory for the XML file and the XML content
 */
export async function defineVm({ vmDir, xml }: { vmDir: string; xml: string }): Promise<void> {
  const xmlPath = join(vmDir, 'domain.xml');
  await writeFile(xmlPath, xml);
  await virsh({ args: ['define', xmlPath], });
}

/**
 * Starts a defined VM.
 *
 * @param options - VM name without the mvm- prefix
 */
export async function startVm({ name }: { name: string }): Promise<void> {
  await virsh({ args: ['start', `${VM_PREFIX}${name}`], });
}

/**
 * Force-stops a running VM (equivalent to pulling the power cord).
 *
 * @param options - VM name without the mvm- prefix
 */
export async function destroyVm({ name }: { name: string }): Promise<void> {
  await virsh({ args: ['destroy', `${VM_PREFIX}${name}`], });
}

/**
 * Removes a VM definition and deletes all associated storage volumes.
 *
 * @param options - VM name without the mvm- prefix
 */
export async function undefineVm({ name }: { name: string }): Promise<void> {
  await virsh({ args: ['undefine', `${VM_PREFIX}${name}`, '--remove-all-storage'], });
}

/**
 * Polls the QEMU guest agent until it responds, indicating the VM has fully booted
 * and is ready to accept commands.
 *
 * @param options - VM name without the mvm- prefix and optional timeout override
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- polling loop
  while (true) {
    try {
      await virsh({ args: ['qemu-agent-command', fullName, pingPayload] });
      rl.info(`guest agent on ${name} is ready`);
      return;
    } catch {
      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new Error(
          `guest agent on ${name} did not respond within ${String(timeoutMs / 1000)}s`,
        );
      }
      rl.debug(`guest agent not ready yet (${String(Math.round(elapsed / 1000))}s elapsed), retrying...`);
      await Bun.sleep(AGENT_POLL_INTERVAL_MS);
    }
  }
}

/**
 * Sends a graceful shutdown request to a VM via the guest agent.
 *
 * @param options - VM name without the mvm- prefix
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
 * @param options - VM name without the mvm- prefix
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

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- polling loop
  while (true) {
    const state = await virsh({ args: ['domstate', fullName] });
    if (state === 'shut off') {
      rl.info(`VM ${name} has shut down`);
      return;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed >= SHUTDOWN_TIMEOUT_MS) {
      throw new Error(
        `VM ${name} did not shut down within ${String(SHUTDOWN_TIMEOUT_MS / 1000)}s`,
      );
    }

    rl.debug(`VM state: ${state} (${String(Math.round(elapsed / 1000))}s elapsed)`);
    await Bun.sleep(SHUTDOWN_POLL_INTERVAL_MS);
  }
}

/**
 * Lists all VMs managed by this tool (those with the `mvm-` prefix).
 *
 * @returns Array of VM names without the prefix
 */
export async function listVms(): Promise<ReadonlyArray<string>> {
  const output = await virsh({ args: ['list', '--all', '--name'], });
  return output
    .split('\n')
    .filter((line) => line.startsWith(VM_PREFIX))
    .map((line) => line.slice(VM_PREFIX.length));
}

