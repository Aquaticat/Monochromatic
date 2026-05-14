import { VM_PREFIX, } from './config.ts';
import {
  l,
  tagged,
} from './log.ts';
import { virsh, } from './virsh.ts';

/** Single VM entry with its display name and current libvirt state. */
export type VmInfo = {
  name: string;
  state: string;
};

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
  /** Logger scoped to this call so debug output is attributable. */
  const rl = tagged({
    tag: list.name,
    l,
  },);
  rl.debug('querying virsh for all VMs',);

  /** Raw multi-line output from `virsh list --all`; parsed line by line below. */
  const output = await virsh({ args: [
    'list',
    '--all',
  ], },);
  /** Each row of the virsh table, including the header and separator rows the regex below filters out. */
  const lines = output.split('\n',);

  /** Accumulator for prefixed VMs found in the virsh table; returned as the result. */
  const vms: VmInfo[] = [];

  for (const line of lines) {
    /** Regex match against a virsh row: id, name, state; null on non-data rows. */
    const match = /\s+(?:\d+|-)\s+(\S+)\s+(.+)/.exec(line,);
    /** Captured VM name from the regex; may be undefined when the line is not a data row. */
    const vmName = match?.[1];
    /** Captured state column from the regex; trimmed when emitted because it carries trailing spaces. */
    const vmState = match?.[2];
    if ((vmName !== undefined) && (vmState !== undefined) && vmName.startsWith(VM_PREFIX,)) {
      vms.push({
        name: vmName.slice(VM_PREFIX.length,),
        state: vmState.trim(),
      },);
    }
  }

  rl.debug(`found ${String(vms.length,)} managed VMs`,);
  return vms;
}
