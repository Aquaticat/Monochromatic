import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { createSeedIso } from './cloud-init.ts';
import { DEFAULT_DISK_SIZE, IMAGES_DIR, VMS_DIR } from './config.ts';
import { domainXml } from './domain-xml.ts';
import { ensureImage } from './image.ts';
import { l, tagged } from './log.ts';
import type { ImageSpec } from './registry.ts';
import { run } from './run.ts';
import {
  defineVm,
  destroyVm,
  shutdownVm,
  startVm,
  undefineVm,
  waitForGuestAgent,
  waitForShutdown,
} from './virsh.ts';

/**
 * Timeout for guest agent during template creation.
 * Longer than normal because cloud-init needs to install qemu-guest-agent.
 */
const TEMPLATE_AGENT_TIMEOUT_MS = 120_000;

/** Name used for the temporary VM during template creation. */
const TEMPLATE_VM_NAME = 'template-setup';

/**
 * Ensures a template image with qemu-guest-agent pre-installed exists for the
 * given image spec. On first run, creates a temporary VM from the base cloud
 * image, waits for cloud-init to install qemu-guest-agent, gracefully shuts
 * down, then saves the disk as a reusable template. Subsequent calls return
 * the cached path.
 *
 * Each image gets its own template (e.g. `template-ubuntu.qcow2`,
 * `template-fedora.qcow2`) so multiple distros coexist in the cache.
 *
 * @param spec - Image specification from the registry
 * @returns Absolute path to the template qcow2 image
 * @throws Error when template creation fails
 *
 * @example
 * ```ts
 * const templatePath = await ensureTemplate(IMAGES['ubuntu']);
 * // => /home/user/.local/share/mvm/images/template-ubuntu.qcow2
 * ```
 */
export async function ensureTemplate(spec: ImageSpec): Promise<string> {
  const rl = tagged({ tag: ensureTemplate.name, l });
  const templatePath = join(IMAGES_DIR, spec.templateFileName);

  if (existsSync(templatePath)) {
    rl.info(`using cached template ${templatePath}`);
    return templatePath;
  }

  rl.info(`creating template ${spec.templateFileName} with qemu-guest-agent pre-installed...`);

  const baseImage = await ensureImage(spec);
  const vmDir = join(VMS_DIR, TEMPLATE_VM_NAME);
  await mkdir(vmDir, { recursive: true });

  const diskPath = join(vmDir, 'disk.qcow2');

  try {
    rl.info('creating overlay disk from base image...');
    await run({
      command: 'qemu-img',
      args: ['create', '-f', 'qcow2', '-b', baseImage, '-F', 'qcow2', diskPath, DEFAULT_DISK_SIZE],
    });

    const seedIsoPath = await createSeedIso({ guest: spec, name: TEMPLATE_VM_NAME, template: true, vmDir });
    const xml = domainXml({ diskPath, name: TEMPLATE_VM_NAME, seedIsoPath });

    await defineVm({ vmDir, xml });
    await startVm({ name: TEMPLATE_VM_NAME });
    await waitForGuestAgent({ name: TEMPLATE_VM_NAME, timeoutMs: TEMPLATE_AGENT_TIMEOUT_MS });

    rl.info('guest agent ready, shutting down template VM...');
    await shutdownVm({ name: TEMPLATE_VM_NAME });
    await waitForShutdown({ name: TEMPLATE_VM_NAME });

    rl.info('converting overlay to standalone template image...');
    await run({
      command: 'qemu-img',
      args: ['convert', '-O', 'qcow2', diskPath, templatePath],
    });

    rl.info(`template image saved to ${templatePath}`);
  } finally {
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
    await rm(vmDir, { force: true, recursive: true });
  }

  return templatePath;
}
