import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createSeedIso } from './cloud-init.ts';
import { DEFAULT_DISK_SIZE, VMS_DIR, validateName } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { l, tagged } from './log.ts';
import { run } from './run.ts';
import { ensureTemplate } from './template.ts';
import { defineVm, startVm, waitForGuestAgent } from './virsh.ts';

/**
 * Creates a new Ubuntu VM from the pre-built template image and starts it.
 * The template already has qemu-guest-agent installed, so boot is fast.
 *
 * @param options - VM name (alphanumeric, hyphens, underscores)
 * @throws Error on invalid name or disk creation failure
 *
 * @example
 * ```ts
 * await create({ name: 'dev-01' });
 * ```
 */
export async function create({ name }: { name: string }): Promise<void> {
  validateName(name);
  const rl = tagged({ tag: create.name, l, });
  const vmDir = join(VMS_DIR, name);

  rl.info(`creating VM ${name}`);
  await mkdir(vmDir, { recursive: true, });

  const templateImage = await ensureTemplate();
  const diskPath = join(vmDir, 'disk.qcow2');

  rl.info('creating disk from template image...');
  await run({
    command: 'qemu-img',
    args: ['create', '-f', 'qcow2', '-b', templateImage, '-F', 'qcow2', diskPath, DEFAULT_DISK_SIZE],
  });

  const seedIsoPath = await createSeedIso({ name, vmDir, });
  const xml = domainXml({ diskPath, name, seedIsoPath, });

  await defineVm({ vmDir, xml, });
  await startVm({ name, });
  await waitForGuestAgent({ name, });

  rl.info(`VM ${name} is ready. Connect with: mvm shell ${name}`);
}
