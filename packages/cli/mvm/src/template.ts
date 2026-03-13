import { existsSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { createAutounattendIso } from './autounattend.ts';
import { createSeedIso } from './cloud-init.ts';
import { DEFAULT_DISK_SIZE, IMAGES_DIR, VMS_DIR, WINDOWS_DISK_SIZE } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { ensureImage, ensureVirtioWin } from './image.ts';
import { l, tagged } from './log.ts';
import type { ImageSpec, LinuxImageSpec, WindowsImageSpec } from './registry.ts';
import { spawn } from './spawn.ts';
import {
  defineVm,
  destroyVm,
  shutdownVm,
  startVm,
  undefineVm,
  waitForGuestAgent,
  waitForShutdown,
} from './virsh.ts';

//region Constants

/**
 * Timeout for guest agent during Linux template creation.
 * Longer than normal because cloud-init needs to install qemu-guest-agent.
 */
const LINUX_TEMPLATE_AGENT_TIMEOUT_MS = 120_000;

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

/** Name used for the temporary VM during template creation. */
const TEMPLATE_VM_NAME = 'template-setup';

//endregion Constants

//region Linux template baking

/**
 * Creates a Linux template from a cloud image by booting a temporary VM
 * with cloud-init configured to install qemu-guest-agent, then converting
 * the result to a standalone qcow2.
 *
 * @param spec - Linux image specification from the registry
 *
 * @returns Absolute path to the baked template qcow2
 *
 * @throws Error when template creation fails
 *
 * @example
 * ```ts
 * const path = await ensureLinuxTemplate(IMAGES['ubuntu'] as LinuxImageSpec);
 * ```
 */
async function ensureLinuxTemplate(spec: LinuxImageSpec): Promise<string> {
  const rl = tagged({ tag: ensureLinuxTemplate.name, l });
  const templatePath = join(IMAGES_DIR, spec.templateFileName);

  rl.info(`creating template ${spec.templateFileName} with qemu-guest-agent pre-installed...`);

  const baseImage = await ensureImage(spec);
  const vmDir = join(VMS_DIR, TEMPLATE_VM_NAME);
  await mkdir(vmDir, { recursive: true });

  const diskPath = join(vmDir, 'disk.qcow2');

  // Symbol.asyncDispose not supported by nano-spawn/virsh subprocess lifecycle; try/finally is required here
  try {
    rl.info('creating overlay disk from base image...');
    await spawn({
      command: 'qemu-img',
      args: ['create', '-f', 'qcow2', '-b', baseImage, '-F', 'qcow2', diskPath, DEFAULT_DISK_SIZE],
    });

    const seedIsoPath = await createSeedIso({ guest: spec, name: TEMPLATE_VM_NAME, template: true, vmDir });
    const xml = domainXml({ diskPath, name: TEMPLATE_VM_NAME, seedIsoPath });

    await defineVm({ vmDir, xml });
    await startVm({ name: TEMPLATE_VM_NAME });
    await waitForGuestAgent({ name: TEMPLATE_VM_NAME, timeoutMs: LINUX_TEMPLATE_AGENT_TIMEOUT_MS });

    rl.info('guest agent ready, shutting down template VM...');
    await shutdownVm({ name: TEMPLATE_VM_NAME });
    await waitForShutdown({ name: TEMPLATE_VM_NAME });

    rl.info('converting overlay to standalone template image...');
    await spawn({
      command: 'qemu-img',
      args: ['convert', '-O', 'qcow2', diskPath, templatePath],
    });

    rl.info(`template image saved to ${templatePath}`);
  } finally {
    await cleanupTemplateVm(rl);
  }

  return templatePath;
}

//endregion Linux template baking

//region Windows template baking

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
async function ensureWindowsTemplate(spec: WindowsImageSpec): Promise<string> {
  const rl = tagged({ tag: ensureWindowsTemplate.name, l });
  const templatePath = join(IMAGES_DIR, spec.templateFileName);

  rl.info(`creating Windows template ${spec.templateFileName} from evaluation ISO...`);
  rl.info('this will take 15-30 minutes for unattended Windows installation');

  // Download both the Windows ISO and virtio-win ISO
  const [windowsIsoPath, virtioWinPath] = await Promise.all([
    ensureImage(spec),
    ensureVirtioWin(),
  ]);

  const vmDir = join(VMS_DIR, TEMPLATE_VM_NAME);
  await mkdir(vmDir, { recursive: true });

  const diskPath = join(vmDir, 'disk.qcow2');

  // Symbol.asyncDispose not supported by nano-spawn/virsh subprocess lifecycle; try/finally is required here
  try {
    rl.info('creating empty disk for Windows installation...');
    await spawn({
      command: 'qemu-img',
      args: ['create', '-f', 'qcow2', diskPath, WINDOWS_DISK_SIZE],
    });

    // Generate autounattend ISO with answer file for unattended install
    const autounattendIso = createAutounattendIso({
      hostname: TEMPLATE_VM_NAME,
      imageIndex: spec.imageIndex,
    });
    const autounattendIsoPath = join(vmDir, 'autounattend.iso');
    await writeFile(autounattendIsoPath, autounattendIso);

    const xml = domainXml({
      bootDev: 'cdrom',
      cdroms: [
        { path: windowsIsoPath },
        { path: autounattendIsoPath },
        { path: virtioWinPath },
      ],
      diskBus: 'sata',
      diskPath,
      name: TEMPLATE_VM_NAME,
      osFamily: 'windows',
    });

    await defineVm({ vmDir, xml });
    await startVm({ name: TEMPLATE_VM_NAME });

    rl.info('Windows installation in progress (waiting for guest agent)...');
    await waitForGuestAgent({ name: TEMPLATE_VM_NAME, timeoutMs: WINDOWS_TEMPLATE_AGENT_TIMEOUT_MS });

    // Phase 1 complete: Windows installed with SATA disk, VirtIO drivers installed.
    // Now switch to VirtIO disk bus and verify Windows boots with VirtIO storage.
    rl.info('guest agent ready on SATA, switching to VirtIO disk bus...');
    await shutdownVm({ name: TEMPLATE_VM_NAME });
    await waitForShutdown({ name: TEMPLATE_VM_NAME });

    // Redefine VM with VirtIO disk (no CDROMs needed, boot from hard disk)
    await undefineVm({ name: TEMPLATE_VM_NAME });
    const virtioXml = domainXml({
      diskPath,
      name: TEMPLATE_VM_NAME,
      osFamily: 'windows',
    });
    await defineVm({ vmDir, xml: virtioXml });
    await startVm({ name: TEMPLATE_VM_NAME });

    rl.info('verifying Windows boots with VirtIO disk (waiting for guest agent)...');
    await waitForGuestAgent({ name: TEMPLATE_VM_NAME, timeoutMs: VIRTIO_VERIFY_AGENT_TIMEOUT_MS });

    rl.info('VirtIO boot verified, shutting down for template capture...');
    await shutdownVm({ name: TEMPLATE_VM_NAME });
    await waitForShutdown({ name: TEMPLATE_VM_NAME });

    rl.info('converting disk to standalone template image...');
    await spawn({
      command: 'qemu-img',
      args: ['convert', '-O', 'qcow2', diskPath, templatePath],
    });

    rl.info(`Windows template image saved to ${templatePath}`);
  } finally {
    await cleanupTemplateVm(rl);
  }

  return templatePath;
}

//endregion Windows template baking

//region Cleanup

/**
 * Cleans up the temporary template VM and its directory.
 * Tolerates errors since the VM may already be stopped or undefined.
 *
 * @param rl - Logger for status messages
 *
 * @returns Resolves when cleanup is complete
 *
 * @example
 * ```ts
 * await cleanupTemplateVm(rl);
 * ```
 */
async function cleanupTemplateVm(rl: { debug: (msg: string) => void }): Promise<void> {
  rl.debug('cleaning up template VM...');
  try {
    await destroyVm({ name: TEMPLATE_VM_NAME });
  } catch {
    rl.debug('template VM was already stopped');
  }
  try {
    await undefineVm({ name: TEMPLATE_VM_NAME });
  } catch {
    rl.debug('template VM was not defined, skipping undefine');
  }
  await rm(join(VMS_DIR, TEMPLATE_VM_NAME), { force: true, recursive: true });
}

//endregion Cleanup

//region Public API

/**
 * Ensures a template image exists for the given image spec, creating it
 * if not already cached. Dispatches to the appropriate template baking
 * pipeline based on the OS family:
 *
 * - **Linux**: creates a temporary VM from the cloud image, installs
 *   qemu-guest-agent via cloud-init, and captures the result
 * - **Windows**: boots from the evaluation ISO with an Autounattend.xml
 *   answer file, performs a full unattended installation, and captures
 *   the result
 *
 * Each image gets its own template (e.g. `template-ubuntu.qcow2`,
 * `template-windows.qcow2`) so multiple distros coexist in the cache.
 *
 * @param spec - Image specification from the registry
 *
 * @returns Absolute path to the template qcow2 image
 *
 * @throws Error when template creation fails
 *
 * @example
 * ```ts
 * const linuxTemplate = await ensureTemplate(IMAGES['ubuntu']);
 * const windowsTemplate = await ensureTemplate(IMAGES['windows']);
 * ```
 */
export function ensureTemplate(spec: ImageSpec): Promise<string> {
  const rl = tagged({ tag: ensureTemplate.name, l });
  const templatePath = join(IMAGES_DIR, spec.templateFileName);

  if (existsSync(templatePath)) {
    rl.info(`using cached template ${templatePath}`);
    return templatePath;
  }

  if (spec.osFamily === 'windows') {
    return ensureWindowsTemplate(spec);
  }
  return ensureLinuxTemplate(spec);
}

//endregion Public API
