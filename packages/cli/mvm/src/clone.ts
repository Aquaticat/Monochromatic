import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { createSeedIso } from './cloud-init.ts';
import { VMS_DIR, validateName } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { exec } from './exec.ts';
import { l, tagged } from './log.ts';
import { readVmMeta, writeVmMeta } from './meta.ts';
import { CUSTOM_GUEST_DEFAULTS, resolveImage } from './registry.ts';
import { spawn } from './spawn.ts';
import { defineVm, startVm, waitForGuestAgent } from './virsh.ts';

/**
 * Clones an existing VM by copying its disk and creating a new cloud-init seed.
 * The new instance-id in the seed ISO triggers cloud-init to re-run,
 * updating the hostname on the cloned disk. Preserves the source VM's
 * image identifier so the correct guest config is used for cloud-init.
 *
 * For Windows VMs, hostname is set via guest agent after boot instead of
 * cloud-init since Windows does not support the NoCloud datasource.
 *
 * @param destination - Destination VM name
 *
 * @param source - Source VM name to clone from
 *
 * @returns Resolves when the clone is ready
 *
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
  await spawn({
    command: 'qemu-img',
    args: ['convert', '-O', 'qcow2', srcDiskPath, dstDiskPath],
  });

  const meta = await readVmMeta(srcVmDir);
  const resolved = resolveImage(meta.image);
  const guest = resolved.kind === 'registry'
    ? resolved.spec
    : CUSTOM_GUEST_DEFAULTS;

  const seedIsoPath = await createSeedIso({ guest, name: destination, vmDir: dstVmDir, });
  const xml = domainXml({ diskPath: dstDiskPath, name: destination, osFamily: guest.osFamily, seedIsoPath });

  await defineVm({ vmDir: dstVmDir, xml, });
  await startVm({ name: destination, });
  await waitForGuestAgent({ name: destination, });

  // Windows VMs: set hostname via guest agent since cloud-init is not available
  if (guest.osFamily === 'windows') {
    rl.info(`setting Windows hostname to ${destination}`);
    const result = await exec({
      command: `Rename-Computer -NewName '${destination}' -Force`,
      name: destination,
    });
    if (result.exitCode !== 0) {
      rl.info(`hostname change returned exit code ${String(result.exitCode)}: ${result.stderr}`);
    }
  }

  await writeVmMeta({ guest, image: meta.image, vmDir: dstVmDir });
  rl.info(`VM ${destination} is ready (cloned from ${source}). Connect with: mvm shell ${destination}`);
}
