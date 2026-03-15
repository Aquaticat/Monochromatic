import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import { createSeedIso, } from './cloud-init.ts';
import {
  DEFAULT_DISK_SIZE,
  validateName,
  VMS_DIR,
  WINDOWS_DISK_SIZE,
} from './config.ts';
import { domainXml, } from './domain-xml.ts';
import { exec, } from './exec.ts';
import {
  l,
  tagged,
} from './log.ts';
import { writeVmMeta, } from './meta.ts';
import {
  CUSTOM_GUEST_DEFAULTS,
  DEFAULT_IMAGE,
  resolveImage,
} from './registry.ts';
import { spawn, } from './spawn.ts';
import { ensureTemplate, } from './template.ts';
import {
  defineVm,
  startVm,
  waitForGuestAgent,
} from './virsh.ts';

//region Windows post-boot provisioning

/**
 * Sets the hostname on a running Windows VM via the QEMU guest agent.
 * Windows VMs do not use cloud-init, so hostname must be configured
 * after boot using PowerShell via guest-exec.
 *
 * @param hostname - Desired hostname
 *
 * @param name - VM name for guest agent addressing
 *
 * @example
 * ```ts
 * await setWindowsHostname({ name: 'win-01', hostname: 'win-01' });
 * ```
 */
async function setWindowsHostname({ hostname, name, }: {
  hostname: string;
  name: string;
},): Promise<void> {
  const rl = tagged({ tag: setWindowsHostname.name, l, },);
  rl.info(`setting Windows hostname to ${hostname}`,);
  const result = await exec({
    command: `Rename-Computer -NewName '${hostname}' -Force`,
    name,
  },);
  if (result.exitCode !== 0) {
    rl.info(
      `hostname change returned exit code ${String(result.exitCode,)}: ${result.stderr}`,
    );
  }
}

//endregion Windows post-boot provisioning

//region Create

/**
 * Creates a new VM from a template image and starts it.
 * Resolves the image identifier through the built-in registry or custom template lookup.
 * Registry images go through the download-and-template-bake pipeline;
 * custom templates are used as backing files directly.
 *
 * For Linux guests, a cloud-init seed ISO configures hostname and autologin.
 * For Windows guests, the hostname is set via guest agent after boot.
 *
 * @param image - Image identifier (defaults to `ubuntu`)
 *
 * @param name - VM name (alphanumeric, hyphens, underscores)
 *
 * @throws Error on invalid name, unknown image, or disk creation failure
 *
 * @example
 * ```ts
 * await create({ name: 'dev-01' });
 * await create({ image: 'fedora', name: 'build-box' });
 * await create({ image: 'windows', name: 'win-test' });
 * await create({ image: 'my-custom', name: 'special' });
 * ```
 */
export async function create({ image = DEFAULT_IMAGE, name, }: {
  image?: string | undefined;
  name: string;
},): Promise<void> {
  validateName(name,);
  const rl = tagged({ tag: create.name, l, },);
  const vmDir = join(VMS_DIR, name,);

  const resolved = resolveImage(image,);
  rl.info(`creating VM ${name} (image: ${image})`,);
  await mkdir(vmDir, { recursive: true, },);

  const templateImage = resolved.kind === 'registry'
    ? await ensureTemplate(resolved.spec,)
    : resolved.customTemplatePath;

  const guest = resolved.kind === 'registry'
    ? resolved.spec
    : CUSTOM_GUEST_DEFAULTS;

  const diskPath = join(vmDir, 'disk.qcow2',);
  const diskSize = guest.osFamily === 'windows' ? WINDOWS_DISK_SIZE : DEFAULT_DISK_SIZE;

  rl.info('creating disk from template image...',);
  await spawn({
    command: 'qemu-img',
    args: ['create', '-f', 'qcow2', '-b', templateImage, '-F', 'qcow2', diskPath,
      diskSize,],
  },);

  const seedIsoPath = await createSeedIso({ guest, name, vmDir, },);
  const xml = domainXml({ diskPath, name, osFamily: guest.osFamily, seedIsoPath, },);

  await defineVm({ vmDir, xml, },);
  await writeVmMeta({ guest, image, vmDir, },);
  await startVm({ name, },);
  await waitForGuestAgent({ name, },);

  // Windows VMs do not use cloud-init; set hostname via guest agent
  if (guest.osFamily === 'windows')
    await setWindowsHostname({ hostname: name, name, },);
  rl.info(`VM ${name} is ready. Connect with: mvm shell ${name}`,);
}

//endregion Create
