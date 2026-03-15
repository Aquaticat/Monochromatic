/**
 * Linux template baking pipeline.
 * Creates a template from a cloud image by booting a temporary VM
 * with cloud-init configured to install qemu-guest-agent, then converting
 * the result to a standalone qcow2.
 */

import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import { createSeedIso, } from './cloud-init.ts';
import {
  DEFAULT_DISK_SIZE,
  IMAGES_DIR,
  VMS_DIR,
} from './config.ts';
import { domainXml, } from './domain-xml.ts';
import { ensureImage, } from './image.ts';
import {
  l,
  tagged,
} from './log.ts';
import type { LinuxImageSpec, } from './registry.ts';
import { spawn, } from './spawn.ts';
import {
  TEMPLATE_VM_NAME,
  templateVmGuard,
} from './template-shared.ts';
import {
  shutdownVm,
  waitForGuestAgent,
  waitForShutdown,
} from './virsh-wait.ts';
import {
  defineVm,
  startVm,
} from './virsh.ts';

/**
 * Timeout for guest agent during Linux template creation.
 * Longer than normal because cloud-init needs to install qemu-guest-agent.
 */
const LINUX_TEMPLATE_AGENT_TIMEOUT_MS = 120_000;

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
export async function ensureLinuxTemplate(spec: LinuxImageSpec,): Promise<string> {
  const rl = tagged({ tag: ensureLinuxTemplate.name, l, },);
  const templatePath = join(IMAGES_DIR, spec.templateFileName,);

  rl.info(
    `creating template ${spec.templateFileName} with qemu-guest-agent pre-installed...`,
  );

  const baseImage = await ensureImage(spec,);
  const vmDir = join(VMS_DIR, TEMPLATE_VM_NAME,);
  await mkdir(vmDir, { recursive: true, },);

  const diskPath = join(vmDir, 'disk.qcow2',);

  await using _cleanup = templateVmGuard(rl,);

  rl.info('creating overlay disk from base image...',);
  await spawn({
    command: 'qemu-img',
    args: ['create', '-f', 'qcow2', '-b', baseImage, '-F', 'qcow2', diskPath,
      DEFAULT_DISK_SIZE,],
  },);

  const seedIsoPath = await createSeedIso({ guest: spec, name: TEMPLATE_VM_NAME,
    template: true, vmDir, },);
  const xml = domainXml({ diskPath, name: TEMPLATE_VM_NAME, seedIsoPath, },);

  await defineVm({ vmDir, xml, },);
  await startVm({ name: TEMPLATE_VM_NAME, },);
  await waitForGuestAgent({ name: TEMPLATE_VM_NAME,
    timeoutMs: LINUX_TEMPLATE_AGENT_TIMEOUT_MS, },);

  rl.info('guest agent ready, shutting down template VM...',);
  await shutdownVm({ name: TEMPLATE_VM_NAME, },);
  await waitForShutdown({ name: TEMPLATE_VM_NAME, },);

  rl.info('converting overlay to standalone template image...',);
  await spawn({
    command: 'qemu-img',
    args: ['convert', '-O', 'qcow2', diskPath, templatePath,],
  },);

  rl.info(`template image saved to ${templatePath}`,);

  return templatePath;
}
