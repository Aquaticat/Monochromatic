import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createSeedIso } from './cloud-init.ts';
import { VMS_DIR, validateName } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { l, tagged } from './log.ts';
import { run } from './run.ts';
import { defineVm, getVmIp, startVm } from './virsh.ts';

/**
 * Clones an existing VM by copying its disk and creating a new cloud-init seed.
 * The new instance-id in the seed ISO triggers cloud-init to re-run,
 * updating the hostname on the cloned disk.
 *
 * @param options - Source VM name and destination VM name
 * @throws Error when source disk is missing or clone fails
 *
 * @example
 * ```ts
 * await clone({ destination: 'dev-02', source: 'dev-01' });
 * ```
 */
export async function clone({ destination, source }: { destination: string; source: string }): Promise<void> {
  validateName(source);
  validateName(destination);
  const rl = tagged({ tag: clone.name, l, });

  const srcVmDir = join(VMS_DIR, source);
  const dstVmDir = join(VMS_DIR, destination);

  rl.info(`cloning VM ${source} to ${destination}`);
  await mkdir(dstVmDir, { recursive: true, });

  const srcDiskPath = join(srcVmDir, 'disk.qcow2');
  const dstDiskPath = join(dstVmDir, 'disk.qcow2');

  rl.info('copying disk (this may take a moment)...');
  await run({
    command: 'qemu-img',
    args: ['convert', '-O', 'qcow2', srcDiskPath, dstDiskPath],
  });

  const seedIsoPath = await createSeedIso({ name: destination, vmDir: dstVmDir, });
  const xml = domainXml({ diskPath: dstDiskPath, name: destination, seedIsoPath, });

  await defineVm({ vmDir: dstVmDir, xml, });
  await startVm({ name: destination, });

  rl.info('waiting for cloned VM to boot...');
  const ip = await getVmIp({ name: destination, });

  rl.info(`VM ${destination} is ready at ${ip}`);
  console.error(`VM ${destination} is ready (cloned from ${source})`);
  console.error(`  IP:    ${ip}`);
  console.error(`  SSH:   ssh ubuntu@${ip}`);
  console.error(`  Shell: mvm shell ${destination}`);
}
