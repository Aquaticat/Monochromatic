/**
 * Image download and caching for cloud images and ISOs.
 *
 * @module
 */

import { existsSync, } from 'node:fs';
import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import { IMAGES_DIR, } from './config.ts';
import { writeWithProgress, } from './download-progress.ts';
import {
  l,
  tagged,
} from './log.ts';
import {
  type ImageSpec,
  VIRTIO_WIN_FILENAME,
  VIRTIO_WIN_URL,
} from './registry.ts';

/**
 * Downloads a file from a URL to a destination path if not already cached.
 * Shows download progress on stderr when fetching.
 *
 * @param destPath - Destination file path
 *
 * @param tag - Logger tag for status messages
 *
 * @param url - URL to download from
 *
 * @returns Absolute path to the downloaded file
 *
 * @throws Error when the download fails
 *
 * @example
 * ```ts
 * const path = await downloadIfMissing({
 *   url: 'https://example.com/image.qcow2',
 *   destPath: '/home/user/.local/share/mvm/images/image.qcow2',
 *   tag: 'ensureImage',
 * });
 * ```
 */
async function downloadIfMissing({
  destPath,
  tag,
  url,
}: {
  destPath: string;
  tag: string;
  url: string;
},): Promise<string> {
  const rl = tagged({
    tag,
    l,
  },);

  if (existsSync(destPath,)) {
    rl.info(`using cached file ${destPath}`,);
    return destPath;
  }

  rl.info(`downloading to ${destPath}`,);
  await mkdir(
    IMAGES_DIR,
    { recursive: true, },
  );

  const response = await fetch(url,);
  if (!response.ok) {
    throw new Error(
      `failed to download from ${url}: ${response.status} ${response.statusText}`,
    );
  }

  await writeWithProgress({
    destPath,
    response,
    rl,
  },);
  return destPath;
}

/**
 * Ensures a cloud image or evaluation ISO is cached locally, downloading it if missing.
 * Shows download progress on stderr when fetching.
 *
 * @param spec - Image specification from the registry
 *
 * @returns Absolute path to the cached image file
 *
 * @throws Error when the download fails
 *
 * @example
 * ```ts
 * const imagePath = await ensureImage(IMAGES['ubuntu']);
 * // => /home/user/.local/share/mvm/images/noble-server-cloudimg-amd64.img
 *
 * const isoPath = await ensureImage(IMAGES['windows']);
 * // => /home/user/.local/share/mvm/images/windows-server-2025-eval.iso
 * ```
 */
export function ensureImage(spec: ImageSpec,): Promise<string> {
  return downloadIfMissing({
    destPath: join(
      IMAGES_DIR,
      spec.fileName,
    ),
    tag: ensureImage.name,
    url: spec.url,
  },);
}

/**
 * Ensures the virtio-win ISO is cached locally, downloading it if missing.
 * The virtio-win ISO contains VirtIO storage/network drivers and the QEMU
 * guest agent installer, required for Windows template creation.
 *
 * @returns Absolute path to the cached virtio-win ISO
 *
 * @throws Error when the download fails
 *
 * @example
 * ```ts
 * const virtioPath = await ensureVirtioWin();
 * // => /home/user/.local/share/mvm/images/virtio-win.iso
 * ```
 */
export function ensureVirtioWin(): Promise<string> {
  return downloadIfMissing({
    destPath: join(
      IMAGES_DIR,
      VIRTIO_WIN_FILENAME,
    ),
    tag: ensureVirtioWin.name,
    url: VIRTIO_WIN_URL,
  },);
}
