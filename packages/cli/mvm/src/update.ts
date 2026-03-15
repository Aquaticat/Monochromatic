import { existsSync, } from 'node:fs';
import { rm, } from 'node:fs/promises';
import { join, } from 'node:path';

import { IMAGES_DIR, } from './config.ts';
import {
  l,
  tagged,
} from './log.ts';
import {
  IMAGES,
  VIRTIO_WIN_FILENAME,
} from './registry.ts';
import { ensureTemplate, } from './template.ts';

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
  const rl = tagged({ tag: update.name, l, },);

  rl.info('updating all template images unconditionally',);

  // Delete all cached base images and templates
  const removePromises = Object.entries(IMAGES,).flatMap(
    function buildRemoveOps([name, spec,],) {
      const ops: Promise<void>[] = [];
      const imagePath = join(IMAGES_DIR, spec.fileName,);
      const templatePath = join(IMAGES_DIR, spec.templateFileName,);

      if (existsSync(imagePath,)) {
        rl.info(`removing cached base image for ${name}: ${spec.fileName}`,);
        ops.push(rm(imagePath,),);
      }

      if (existsSync(templatePath,)) {
        rl.info(`removing cached template for ${name}: ${spec.templateFileName}`,);
        ops.push(rm(templatePath,),);
      }
      return ops;
    },
  );
  await Promise.all(removePromises,);

  // Delete cached virtio-win ISO (shared across Windows versions)
  const virtioPath = join(IMAGES_DIR, VIRTIO_WIN_FILENAME,);
  if (existsSync(virtioPath,)) {
    rl.info(`removing cached virtio-win ISO: ${VIRTIO_WIN_FILENAME}`,);
    await rm(virtioPath,);
  }

  // Rebuild all templates sequentially (each may spawn a VM that occupies shared resources)
  const imageEntries = Object.entries(IMAGES,);
  for (const [name, spec,] of imageEntries) {
    rl.info(`rebuilding template for ${name}...`,);
    // oxlint-disable-next-line no-await-in-loop -- templates must build sequentially to avoid resource contention
    await ensureTemplate(spec,);
    rl.info(`template for ${name} rebuilt successfully`,);
  }

  rl.info(`all ${String(imageEntries.length,)} templates updated successfully`,);
}
