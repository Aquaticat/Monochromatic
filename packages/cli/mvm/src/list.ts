import { VM_PREFIX, } from './config.ts';
import {
  l,
  tagged,
} from './log.ts';
import { virsh, } from './virsh.ts';

/** Single VM entry with its display name and current libvirt state. */
export type VmInfo = { name: string; state: string; };

/**
 * Queries libvirt for all managed VMs and returns structured info.
 * Parses `virsh list --all` output and filters for VMs with the `mvm-` prefix.
 *
 * @returns Array of VM entries with name (without prefix) and state
 *
 * @example
 * ```ts
 * const vms = await list();
 * // [{ name: 'dev-01', state: 'running' }, { name: 'dev-02', state: 'shut off' }]
 * ```
 */
export async function list(): Promise<readonly VmInfo[]> {
  const rl = tagged({ tag: list.name, l, },);
  rl.debug('querying virsh for all VMs',);

  const output = await virsh({ args: ['list', '--all',], },);
  const lines = output.split('\n',);

  const vms: VmInfo[] = [];

  for (const line of lines) {
    const match = line.match(/\s+(?:\d+|-)\s+(\S+)\s+(.+)/,);
    const vmName = match?.[1];
    const vmState = match?.[2];
    if (vmName !== undefined && vmState !== undefined && vmName.startsWith(VM_PREFIX,))
      vms.push({ name: vmName.slice(VM_PREFIX.length,), state: vmState.trim(), },);
  }

  rl.debug(`found ${String(vms.length,)} managed VMs`,);
  return vms;
}
