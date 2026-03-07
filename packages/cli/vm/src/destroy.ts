import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { VMS_DIR, validateName } from './config.ts';
import { l, tagged } from './log.ts';
import { destroyVm, undefineVm } from './virsh.ts';

/**
 * Destroys a VM by force-stopping it, removing its libvirt definition,
 * and deleting all associated storage and metadata.
 *
 * @param options - VM name without the mvm- prefix
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
