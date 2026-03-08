import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { LIBVIRT_URI, VM_PREFIX } from './config.ts';
import { run } from './run.ts';

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

