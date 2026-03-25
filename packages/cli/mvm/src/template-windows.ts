/**
 * Windows template baking pipeline.
 * Creates a template by booting from an evaluation ISO with an
 * Autounattend.xml answer file and virtio-win drivers for fully
 * unattended Windows Server installation.
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { createAutounattendIso, } from './autounattend.ts';
import {
  IMAGES_DIR,
  VMS_DIR,
  WINDOWS_DISK_SIZE,
  WINDOWS_TEMPLATE_AGENT_TIMEOUT_MS,
} from './config.ts';
import { domainXml, } from './domain-xml.ts';
import {
  ensureImage,
  ensureVirtioWin,
} from './image.ts';
import {
  l,
  tagged,
} from './log.ts';
import type { WindowsImageSpec, } from './registry.ts';
import { spawn, } from './spawn.ts';
import {
  TEMPLATE_VM_NAME,
  templateVmGuard,
} from './template-shared.ts';
import { verifyVirtioBoot, } from './template-windows-virtio.ts';
import { waitForGuestAgent, } from './virsh-wait.ts';
import {
  defineVm,
  startVm,
} from './virsh.ts';

/**
 * Creates a Windows template by booting from an evaluation ISO with an
 * Autounattend.xml answer file and virtio-win drivers. The unattended
 * install partitions the disk, installs Windows Server, loads VirtIO
 * drivers, installs the QEMU guest agent, and completes OOBE automatically.
 *
 * Template creation takes 15-30 minutes on first run due to the full
 * Windows installation process.
 *
 * @param spec - Windows image specification from the registry
 *
 * @returns Absolute path to the baked template qcow2
 *
 * @throws Error when template creation fails
 *
 * @example
 * ```ts
 * const path = await ensureWindowsTemplate(IMAGES['windows'] as WindowsImageSpec);
 * ```
 */
export async function ensureWindowsTemplate(spec: WindowsImageSpec,): Promise<string> {
  const rl = tagged({
    tag: ensureWindowsTemplate.name,
    l,
  },);
  const templatePath = join(
    IMAGES_DIR,
    spec.templateFileName,
  );

  rl.info(`creating Windows template ${spec.templateFileName} from evaluation ISO...`,);
  rl.info('this will take 15-30 minutes for unattended Windows installation',);

  // Download both the Windows ISO and virtio-win ISO
  const [windowsIsoPath, virtioWinPath,] = await Promise.all([
    ensureImage(spec,),
    ensureVirtioWin(),
  ],);

  const vmDir = join(
    VMS_DIR,
    TEMPLATE_VM_NAME,
  );
  await mkdir(
    vmDir,
    { recursive: true, },
  );

  const diskPath = join(
    vmDir,
    'disk.qcow2',
  );

  await using _cleanup = templateVmGuard(rl,);

  rl.info('creating empty disk for Windows installation...',);
  await spawn({
    command: 'qemu-img',
    args: [
      'create',
      '-f',
      'qcow2',
      diskPath,
      WINDOWS_DISK_SIZE,
    ],
  },);

  // Generate autounattend ISO with answer file for unattended install
  const autounattendIso = createAutounattendIso({
    hostname: TEMPLATE_VM_NAME,
    imageIndex: spec.imageIndex,
  },);
  const autounattendIsoPath = join(
    vmDir,
    'autounattend.iso',
  );
  await writeFile(
    autounattendIsoPath,
    autounattendIso,
  );

  const xml = domainXml({
    bootDev: 'cdrom',
    cdroms: [
      { path: windowsIsoPath, },
      { path: autounattendIsoPath, },
      { path: virtioWinPath, },
    ],
    diskBus: 'sata',
    diskPath,
    name: TEMPLATE_VM_NAME,
    osFamily: 'windows',
  },);

  await defineVm({
    vmDir,
    xml,
  },);
  await startVm({ name: TEMPLATE_VM_NAME, },);

  rl.info('Windows installation in progress (waiting for guest agent)...',);
  await waitForGuestAgent({
    name: TEMPLATE_VM_NAME,
    timeoutMs: WINDOWS_TEMPLATE_AGENT_TIMEOUT_MS,
  },);

  // Phase 1 complete: Windows installed with SATA disk, VirtIO drivers installed.
  // Switch to VirtIO disk bus and verify Windows boots with VirtIO storage.
  await verifyVirtioBoot({
    vmDir,
    diskPath,
    rl,
  },);

  rl.info('converting disk to standalone template image...',);
  await spawn({
    command: 'qemu-img',
    args: [
      'convert',
      '-O',
      'qcow2',
      diskPath,
      templatePath,
    ],
  },);

  rl.info(`Windows template image saved to ${templatePath}`,);

  return templatePath;
}
