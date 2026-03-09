import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createSeedIso } from './cloud-init.ts';
import { VMS_DIR, validateName } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { l, tagged } from './log.ts';
import { CUSTOM_GUEST_DEFAULTS, DEFAULT_IMAGE, resolveImage } from './registry.ts';
import { run } from './run.ts';
import { defineVm, startVm, waitForGuestAgent } from './virsh.ts';

/**
 * Reads the image identifier persisted by {@link create} in the VM directory.
 * Falls back to `ubuntu` for VMs created before image selection was added.
 *
 * @param vmDir - Absolute path to the source VM directory
 * @returns Image identifier string
 *
 * @example
 * ```ts
 * const image = await readVmImage('/home/user/.local/share/mvm/vms/dev-01');
 * // => 'fedora'
 * ```
 */
async function readVmImage(vmDir: string): Promise<string> {
  try {
    const content = await readFile(join(vmDir, 'image'), 'utf8');
    return content.trim();
  } catch {
    return DEFAULT_IMAGE;
  }
}

/**
 * Clones an existing VM by copying its disk and creating a new cloud-init seed.
 * The new instance-id in the seed ISO triggers cloud-init to re-run,
 * updating the hostname on the cloned disk. Preserves the source VM's
 * image identifier so the correct guest config is used for cloud-init.
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

  const image = await readVmImage(srcVmDir);
  const resolved = resolveImage(image);
  const guest = resolved.kind === 'registry'
    ? resolved.spec
    : CUSTOM_GUEST_DEFAULTS;

  const seedIsoPath = await createSeedIso({ guest, name: destination, vmDir: dstVmDir, });
  const xml = domainXml({ diskPath: dstDiskPath, name: destination, seedIsoPath, });

  await defineVm({ vmDir: dstVmDir, xml, });
  await startVm({ name: destination, });
  await waitForGuestAgent({ name: destination, });

  await writeFile(join(dstVmDir, 'image'), image);
  rl.info(`VM ${destination} is ready (cloned from ${source}). Connect with: mvm shell ${destination}`);
}
