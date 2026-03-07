import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import {
  IMAGES_DIR,
  UBUNTU_IMAGE_NAME,
  UBUNTU_IMAGE_URL,
} from './config.ts';
import { l, tagged } from './log.ts';

/**
 * Ensures the Ubuntu cloud image is cached locally, downloading it if missing.
 *
 * @returns Absolute path to the cached qcow2 cloud image
 * @throws Error when the download fails
 *
 * @example
 * ```ts
 * const imagePath = await ensureImage();
 * // => /home/user/.local/share/mvm/images/ubuntu-24.04-cloudimg-amd64.img
 * ```
 */
export async function ensureImage(): Promise<string> {
  const rl = tagged({ tag: ensureImage.name, l, });
  const imagePath = join(IMAGES_DIR, UBUNTU_IMAGE_NAME);

  if (existsSync(imagePath)) {
    rl.info(`using cached image ${imagePath}`);
    return imagePath;
  }

  rl.info('downloading Ubuntu 24.04 LTS cloud image...');
  await mkdir(IMAGES_DIR, { recursive: true, });

  const response = await fetch(UBUNTU_IMAGE_URL);
  if (!response.ok) {
    throw new Error(`failed to download image: ${response.status} ${response.statusText}`);
  }

  await Bun.write(imagePath, response);
  rl.info(`saved to ${imagePath}`);
  return imagePath;
}
