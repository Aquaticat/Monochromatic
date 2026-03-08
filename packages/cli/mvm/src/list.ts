import { VM_PREFIX } from './config.ts';
import { l, tagged } from './log.ts';
import { virsh } from './virsh.ts';

/**
 * Lists all VMs managed by this tool with their current state.
 * Parses `virsh list --all` output and filters for VMs with the `mvm-` prefix.
 *
 * @example
 * ```ts
 * await list();
 * // dev-01               running
 * // dev-02               shut off
 * ```
 */
export async function list(): Promise<void> {
  const rl = tagged({ tag: list.name, l, });
  rl.debug('querying virsh for all VMs');

  const output = await virsh({ args: ['list', '--all'], });
  const lines = output.split('\n');

  type VmInfo = { name: string; state: string };
  const vms: VmInfo[] = [];

  for (const line of lines) {
    const match = /\s+(?:\d+|-)\s+(\S+)\s+(.+)/.exec(line);
    if (match !== null && match[1]!.startsWith(VM_PREFIX)) {
      vms.push({ name: match[1]!.slice(VM_PREFIX.length), state: match[2]!.trim(), });
    }
  }

  if (vms.length === 0) {
    rl.info('no VMs found');
    return;
  }

  /** Column width for aligned output. */
  const NAME_COL_WIDTH = 24;
  for (const vm of vms) {
    rl.info(`${vm.name.padEnd(NAME_COL_WIDTH)} ${vm.state}`);
  }
}
