import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

import { IMAGES_DIR } from './config.ts';
import { l, tagged } from './log.ts';
import { IMAGES, VIRTIO_WIN_FILENAME } from './registry.ts';
import { ensureTemplate } from './template.ts';

/**
 * Updates all template images unconditionally by deleting cached base images
 * and templates, then re-downloading and re-building every registered image.
 * Builds templates for all images in the registry, even those that were
 * never previously used.
 *
 * For Linux images, re-downloads cloud images and re-bakes templates with
 * qemu-guest-agent. For Windows images, re-downloads the evaluation ISO
 * and virtio-win ISO, then performs a full unattended reinstall.
 *
 * Use this command to:
 * - Refresh Windows evaluation ISOs before they expire (180-day limit)
 * - Pick up new cloud image releases for Linux distros
 * - Rebuild templates after a virtio-win driver update
 *
 * @throws Error when any download or template creation fails
 *
 * @example
 * ```ts
 * await update();
 * ```
 */
export async function update(): Promise<void> {
  const rl = tagged({ tag: update.name, l });

  rl.info('updating all template images unconditionally');

  // Delete all cached base images and templates
  for (const [name, spec] of Object.entries(IMAGES)) {
    const imagePath = join(IMAGES_DIR, spec.fileName);
    const templatePath = join(IMAGES_DIR, spec.templateFileName);

    if (existsSync(imagePath)) {
      rl.info(`removing cached base image for ${name}: ${spec.fileName}`);
      await rm(imagePath);
    }

    if (existsSync(templatePath)) {
      rl.info(`removing cached template for ${name}: ${spec.templateFileName}`);
      await rm(templatePath);
    }
  }

  // Delete cached virtio-win ISO (shared across Windows versions)
  const virtioPath = join(IMAGES_DIR, VIRTIO_WIN_FILENAME);
  if (existsSync(virtioPath)) {
    rl.info(`removing cached virtio-win ISO: ${VIRTIO_WIN_FILENAME}`);
    await rm(virtioPath);
  }

  // Rebuild all templates (downloads happen inside ensureTemplate)
  const imageEntries = Object.entries(IMAGES);
  for (const [name, spec] of imageEntries) {
    rl.info(`rebuilding template for ${name}...`);
    await ensureTemplate(spec);
    rl.info(`template for ${name} rebuilt successfully`);
  }

  rl.info(`all ${String(imageEntries.length)} templates updated successfully`);
}
