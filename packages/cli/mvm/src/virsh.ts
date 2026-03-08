import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LIBVIRT_URI, VM_PREFIX } from './config.ts';
import { l, tagged } from './log.ts';
import { run } from './run.ts';

/** Milliseconds between guest agent ping attempts. */
const AGENT_POLL_INTERVAL_MS = 1000;

/** Maximum milliseconds to wait for guest agent before giving up. */
const AGENT_TIMEOUT_MS = 60_000;

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
 * @param options - VM name without the mvm- prefix
 * @throws Error when the guest agent does not respond within the timeout
 *
 * @example
 * ```ts
 * await waitForGuestAgent({ name: 'dev-01' });
 * ```
 */
export async function waitForGuestAgent({ name }: { name: string }): Promise<void> {
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
      if (elapsed >= AGENT_TIMEOUT_MS) {
        throw new Error(
          `guest agent on ${name} did not respond within ${String(AGENT_TIMEOUT_MS / 1000)}s`,
        );
      }
      rl.debug(`guest agent not ready yet (${String(Math.round(elapsed / 1000))}s elapsed), retrying...`);
      await Bun.sleep(AGENT_POLL_INTERVAL_MS);
    }
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

