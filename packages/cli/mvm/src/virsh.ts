/**
 * Core libvirt/virsh operations for VM management.
 *
 * @module
 */

import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import {
  LIBVIRT_URI,
  VM_PREFIX,
} from './config.ts';
import { spawn, } from './spawn.ts';

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
export function virsh({ args, }: { readonly args: readonly string[]; },): Promise<string> {
  return spawn({
    command: 'virsh',
    args: [
      '--connect',
      LIBVIRT_URI,
      ...args,
    ],
  },);
}

/**
 * Defines a VM in libvirt from an XML string.
 * Writes the XML to a file in the VM directory, then calls `virsh define`.
 *
 * @param vmDir - Directory to write the XML file into
 *
 * @param xml - XML content for the domain definition
 *
 * @example
 * ```ts
 * await defineVm({ vmDir: '/vms/myvm', xml: domainXmlString });
 * ```
 */
export async function defineVm(
  {
    vmDir,
    xml,
  }: {
    readonly vmDir: string;
    readonly xml: string;
  },
): Promise<void> {
  /**
   * XML written to disk because virsh define expects a file path, not stdin.
   */
  const xmlPath = join(
    vmDir,
    'domain.xml',
  );
  await writeFile(
    xmlPath,
    xml,
  );
  await virsh({ args: [
    'define',
    xmlPath,
  ], },);
}

/**
 * Starts a defined VM.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @example
 * ```ts
 * await startVm({ name: 'win11' });
 * ```
 */
export async function startVm({ name, }: { readonly name: string; },): Promise<void> {
  await virsh({ args: [
    'start',
    `${VM_PREFIX}${name}`,
  ], },);
}

/**
 * Force-stops a running VM (equivalent to pulling the power cord).
 *
 * @param name - VM name without the mvm- prefix
 *
 * @example
 * ```ts
 * await destroyVm({ name: 'win11' });
 * ```
 */
export async function destroyVm({ name, }: { readonly name: string; },): Promise<void> {
  await virsh({ args: [
    'destroy',
    `${VM_PREFIX}${name}`,
  ], },);
}

/**
 * Removes a VM definition and deletes all associated storage volumes.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @example
 * ```ts
 * await undefineVm({ name: 'win11' });
 * ```
 */
export async function undefineVm({ name, }: { readonly name: string; },): Promise<void> {
  await virsh({ args: [
    'undefine',
    `${VM_PREFIX}${name}`,
    '--remove-all-storage',
  ], },);
}

/**
 * Lists all VMs managed by this tool (those with the `mvm-` prefix).
 *
 * @returns Array of VM names without the prefix
 *
 * @example
 * ```ts
 * const vms = await listVms(); // e.g. ['win11', 'fedora']
 * ```
 */
export async function listVms(): Promise<readonly string[]> {
  /**
   * Raw virsh list output filtered for the mvm- prefix on subsequent lines.
   */
  const output = await virsh({ args: [
    'list',
    '--all',
    '--name',
  ], },);
  return output
    .split('\n',)
    .filter(function startsWithPrefix(line,) {
      return line.startsWith(VM_PREFIX,);
    },)
    .map(function stripPrefix(line,) {
      return line.slice(VM_PREFIX.length,);
    },);
}
