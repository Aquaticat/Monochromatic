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
import {
  defineVm,
  shutdownVm,
  startVm,
  undefineVm,
  waitForGuestAgent,
  waitForShutdown,
} from './virsh.ts';

/**
 * Timeout for guest agent during Windows template creation.
 * Windows unattended install takes 15-30 minutes: OS installation,
 * first boot, OOBE, and guest agent installation via FirstLogonCommands.
 */
const WINDOWS_TEMPLATE_AGENT_TIMEOUT_MS = 2_400_000;

/**
 * Timeout for guest agent during VirtIO disk bus verification.
 * After switching from SATA to VirtIO, Windows needs to detect the new
 * disk controller and load the viostor driver on boot. Typically takes
 * 2-5 minutes including the full Windows boot cycle.
 */
const VIRTIO_VERIFY_AGENT_TIMEOUT_MS = 300_000;

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
  const rl = tagged({ tag: ensureWindowsTemplate.name, l, },);
  const templatePath = join(IMAGES_DIR, spec.templateFileName,);

  rl.info(`creating Windows template ${spec.templateFileName} from evaluation ISO...`,);
  rl.info('this will take 15-30 minutes for unattended Windows installation',);

  // Download both the Windows ISO and virtio-win ISO
  const [windowsIsoPath, virtioWinPath,] = await Promise.all([
    ensureImage(spec,),
    ensureVirtioWin(),
  ],);

  const vmDir = join(VMS_DIR, TEMPLATE_VM_NAME,);
  await mkdir(vmDir, { recursive: true, },);

  const diskPath = join(vmDir, 'disk.qcow2',);

  await using _cleanup = templateVmGuard(rl,);

  rl.info('creating empty disk for Windows installation...',);
  await spawn({
    command: 'qemu-img',
    args: ['create', '-f', 'qcow2', diskPath, WINDOWS_DISK_SIZE,],
  },);

  // Generate autounattend ISO with answer file for unattended install
  const autounattendIso = createAutounattendIso({
    hostname: TEMPLATE_VM_NAME,
    imageIndex: spec.imageIndex,
  },);
  const autounattendIsoPath = join(vmDir, 'autounattend.iso',);
  await writeFile(autounattendIsoPath, autounattendIso,);

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

  await defineVm({ vmDir, xml, },);
  await startVm({ name: TEMPLATE_VM_NAME, },);

  rl.info('Windows installation in progress (waiting for guest agent)...',);
  await waitForGuestAgent({ name: TEMPLATE_VM_NAME,
    timeoutMs: WINDOWS_TEMPLATE_AGENT_TIMEOUT_MS, },);

  // Phase 1 complete: Windows installed with SATA disk, VirtIO drivers installed.
  // Now switch to VirtIO disk bus and verify Windows boots with VirtIO storage.
  rl.info('guest agent ready on SATA, switching to VirtIO disk bus...',);
  await shutdownVm({ name: TEMPLATE_VM_NAME, },);
  await waitForShutdown({ name: TEMPLATE_VM_NAME, },);

  // Redefine VM with VirtIO disk (no CDROMs needed, boot from hard disk)
  await undefineVm({ name: TEMPLATE_VM_NAME, },);
  const virtioXml = domainXml({
    diskPath,
    name: TEMPLATE_VM_NAME,
    osFamily: 'windows',
  },);
  await defineVm({ vmDir, xml: virtioXml, },);
  await startVm({ name: TEMPLATE_VM_NAME, },);

  rl.info('verifying Windows boots with VirtIO disk (waiting for guest agent)...',);
  await waitForGuestAgent({ name: TEMPLATE_VM_NAME,
    timeoutMs: VIRTIO_VERIFY_AGENT_TIMEOUT_MS, },);

  rl.info('VirtIO boot verified, shutting down for template capture...',);
  await shutdownVm({ name: TEMPLATE_VM_NAME, },);
  await waitForShutdown({ name: TEMPLATE_VM_NAME, },);

  rl.info('converting disk to standalone template image...',);
  await spawn({
    command: 'qemu-img',
    args: ['convert', '-O', 'qcow2', diskPath, templatePath,],
  },);

  rl.info(`Windows template image saved to ${templatePath}`,);

  return templatePath;
}
