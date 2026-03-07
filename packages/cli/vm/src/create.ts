import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createSeedIso } from './cloud-init.ts';
import { DEFAULT_DISK_SIZE, VMS_DIR, validateName } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { ensureImage } from './image.ts';
import { l, tagged } from './log.ts';
import { run } from './run.ts';
import { defineVm, getVmIp, startVm } from './virsh.ts';

/**
 * Creates a new Ubuntu VM with a backing-file disk, cloud-init seed, and starts it.
 * Waits for the VM to obtain an IP address before returning.
 *
 * @param options - VM name (alphanumeric, hyphens, underscores)
 * @throws Error on invalid name, disk creation failure, or boot timeout
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

  const baseImage = await ensureImage();
  const diskPath = join(vmDir, 'disk.qcow2');

  rl.info('creating disk from base image...');
  await run({
    command: 'qemu-img',
    args: ['create', '-f', 'qcow2', '-b', baseImage, '-F', 'qcow2', diskPath, DEFAULT_DISK_SIZE],
  });

  const seedIsoPath = await createSeedIso({ name, vmDir, });
  const xml = domainXml({ diskPath, name, seedIsoPath, });

  await defineVm({ vmDir, xml, });
  await startVm({ name, });

  rl.info('waiting for VM to boot...');
  const ip = await getVmIp({ name, });

  rl.info(`VM ${name} is ready at ${ip}`);
  console.error(`VM ${name} is ready`);
  console.error(`  IP:    ${ip}`);
  console.error(`  SSH:   ssh ubuntu@${ip}`);
  console.error(`  Shell: mvm shell ${name}`);
}
