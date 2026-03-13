import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { VMS_DIR, validateName } from './config.ts';
import { l, tagged } from './log.ts';
import { destroyVm, listVms, undefineVm } from './virsh.ts';

/**
 * Destroys a single VM by force-stopping it, removing its libvirt definition,
 * and deleting all associated storage and metadata.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @param rl - Tagged logger for status messages
 *
 * @returns Resolves when the VM is fully destroyed
 *
 * @throws Error when the VM cannot be undefined (e.g. does not exist)
 *
 * @example
 * ```ts
 * await destroyOne({ name: 'dev-01', rl: logger });
 * ```
 */
async function destroyOne({ name, rl }: { name: string; rl: { debug: (msg: string) => void; info: (msg: string) => void } }): Promise<void> {
  rl.info(`destroying VM ${name}`);

  try {
    await destroyVm({ name, });
  } catch {
    rl.debug('VM was not running, proceeding with undefine');
  }

  await undefineVm({ name, });

  const vmDir = join(VMS_DIR, name);
  await rm(vmDir, { force: true, recursive: true, });

  rl.info(`VM ${name} destroyed`);
}

/**
 * Destroys a VM by force-stopping it, removing its libvirt definition,
 * and deleting all associated storage and metadata.
 *
 * @param name - VM name without the mvm- prefix
 *
 * @returns Resolves when the VM is fully destroyed
 *
 * @throws Error when the VM cannot be undefined (e.g. does not exist)
 *
 * @example
 * ```ts
 * await destroy({ name: 'dev-01' });
 * ```
 */
export async function destroy({ name }: { name: string }): Promise<void> {
  validateName(name);
  const rl = tagged({ tag: destroy.name, l, });
  await destroyOne({ name, rl, });
}

/**
 * Destroys all managed VMs.
 *
 * @returns Resolves when all VMs are destroyed
 *
 * @throws Error when any VM cannot be destroyed
 *
 * @example
 * ```ts
 * await destroyAll();
 * ```
 */
export async function destroyAll(): Promise<void> {
  const rl = tagged({ tag: destroyAll.name, l, });
  const vms = await listVms();

  if (vms.length === 0) {
    rl.info('no VMs to destroy');
    return;
  }

  rl.info(`destroying all ${String(vms.length)} VMs`);
  // Destroy sequentially to avoid overwhelming libvirt with concurrent operations
  for (const name of vms) {
    // oxlint-disable-next-line eslint(no-await-in-loop) -- intentionally sequential to avoid libvirt contention
    await destroyOne({ name, rl, });
  }
}
