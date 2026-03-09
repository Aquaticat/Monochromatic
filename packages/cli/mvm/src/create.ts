import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createSeedIso } from './cloud-init.ts';
import { DEFAULT_DISK_SIZE, VMS_DIR, validateName } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { l, tagged } from './log.ts';
import { CUSTOM_GUEST_DEFAULTS, DEFAULT_IMAGE, resolveImage } from './registry.ts';
import { run } from './run.ts';
import { ensureTemplate } from './template.ts';
import { defineVm, startVm, waitForGuestAgent } from './virsh.ts';

/**
 * Creates a new VM from a template image and starts it.
 * Resolves the image identifier through the built-in registry or custom template lookup.
 * Registry images go through the download-and-template-bake pipeline;
 * custom templates are used as backing files directly.
 *
 * @param options - VM name and optional image identifier (defaults to `ubuntu`)
 * @throws Error on invalid name, unknown image, or disk creation failure
 *
 * @example
 * ```ts
 * await create({ name: 'dev-01' });
 * await create({ image: 'fedora', name: 'build-box' });
 * await create({ image: 'my-custom', name: 'special' });
 * ```
 */
export async function create({ image = DEFAULT_IMAGE, name }: {
  image?: string | undefined;
  name: string;
}): Promise<void> {
  validateName(name);
  const rl = tagged({ tag: create.name, l, });
  const vmDir = join(VMS_DIR, name);

  const resolved = resolveImage(image);
  rl.info(`creating VM ${name} (image: ${image})`);
  await mkdir(vmDir, { recursive: true, });

  const templateImage = resolved.kind === 'registry'
    ? await ensureTemplate(resolved.spec)
    : resolved.customTemplatePath;

  const diskPath = join(vmDir, 'disk.qcow2');

  rl.info('creating disk from template image...');
  await run({
    command: 'qemu-img',
    args: ['create', '-f', 'qcow2', '-b', templateImage, '-F', 'qcow2', diskPath, DEFAULT_DISK_SIZE],
  });

  const guest = resolved.kind === 'registry'
    ? resolved.spec
    : CUSTOM_GUEST_DEFAULTS;

  const seedIsoPath = await createSeedIso({ guest, name, vmDir, });
  const xml = domainXml({ diskPath, name, seedIsoPath, });

  await defineVm({ vmDir, xml, });
  await startVm({ name, });
  await waitForGuestAgent({ name, });

  await writeFile(join(vmDir, 'image'), image);
  rl.info(`VM ${name} is ready. Connect with: mvm shell ${name}`);
}
