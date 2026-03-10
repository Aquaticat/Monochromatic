import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import { IMAGES_DIR } from './config.ts';
import { l, tagged } from './log.ts';
import type { ImageSpec } from './registry.ts';
import { VIRTIO_WIN_FILENAME, VIRTIO_WIN_URL } from './registry.ts';

//region Download progress

/**
 * Formats a byte count as a human-readable string (e.g. "123.4 MiB").
 *
 * @param bytes - Raw byte count
 * @returns Formatted string with appropriate unit
 *
 * @example
 * ```ts
 * formatBytes(1_048_576); // => "1.0 MiB"
 * ```
 */
function formatBytes(bytes: number): string {
  const GIB = 1024 * 1024 * 1024;
  if (bytes >= GIB) {
    return `${(bytes / GIB).toFixed(1)} GiB`;
  }
  const MIB = 1024 * 1024;
  if (bytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)} MiB`;
  }
  const KIB = 1024;
  return `${(bytes / KIB).toFixed(0)} KiB`;
}

/**
 * Streams a fetch response body to a file while printing download progress to stderr.
 * Writes chunks directly to disk using a file writer to avoid accumulating the entire
 * file in memory. Critical for large downloads like Windows evaluation ISOs (~5 GiB).
 *
 * @param options - Response to stream, destination file path, and logger instance
 * @throws Error when the response body is null
 *
 * @example
 * ```ts
 * await streamWithProgress({ response, destPath: '/tmp/image.img', rl: logger });
 * ```
 */
async function streamWithProgress({ destPath, response, rl }: {
  destPath: string;
  response: Response;
  rl: { info: (msg: string) => void };
}): Promise<void> {
  const body = response.body;
  if (body === null) {
    throw new Error('response body is null');
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  const totalStr = contentLength > 0 ? formatBytes(contentLength) : 'unknown';
  let downloaded = 0;

  const writer = Bun.file(destPath).writer();
  const reader = body.getReader();
  let lastProgressTime = 0;
  /** Minimum milliseconds between progress line updates to avoid flickering. */
  const PROGRESS_THROTTLE_MS = 250;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- reader.read() loop
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    writer.write(value);
    downloaded += value.length;

    const now = Date.now();
    if (now - lastProgressTime >= PROGRESS_THROTTLE_MS) {
      lastProgressTime = now;
      const downloadedStr = formatBytes(downloaded);
      if (contentLength > 0) {
        const pct = Math.round((downloaded / contentLength) * 100);
        process.stderr.write(`\r  downloading: ${downloadedStr} / ${totalStr} (${String(pct)}%)`);
      } else {
        process.stderr.write(`\r  downloading: ${downloadedStr}`);
      }
    }
  }

  await writer.end();
  process.stderr.write(`\r  downloaded: ${formatBytes(downloaded)} total${' '.repeat(20)}\n`);
  rl.info(`saved to ${destPath}`);
}

//endregion Download progress

//region Generic download

/**
 * Downloads a file from a URL to a destination path if not already cached.
 * Shows download progress on stderr when fetching.
 *
 * @param options - URL to download, destination file path, logger tag, and cache check
 * @returns Absolute path to the downloaded file
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
async function downloadIfMissing({ destPath, tag, url }: {
  destPath: string;
  tag: string;
  url: string;
}): Promise<string> {
  const rl = tagged({ tag, l });

  if (existsSync(destPath)) {
    rl.info(`using cached file ${destPath}`);
    return destPath;
  }

  rl.info(`downloading to ${destPath}`);
  await mkdir(IMAGES_DIR, { recursive: true });

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`failed to download from ${url}: ${response.status} ${response.statusText}`);
  }

  await streamWithProgress({ destPath, response, rl });
  return destPath;
}

//endregion Generic download

//region Image downloads

/**
 * Ensures a cloud image or evaluation ISO is cached locally, downloading it if missing.
 * Shows download progress on stderr when fetching.
 *
 * @param spec - Image specification from the registry
 * @returns Absolute path to the cached image file
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
export async function ensureImage(spec: ImageSpec): Promise<string> {
  return downloadIfMissing({
    destPath: join(IMAGES_DIR, spec.fileName),
    tag: ensureImage.name,
    url: spec.url,
  });
}

/**
 * Ensures the virtio-win ISO is cached locally, downloading it if missing.
 * The virtio-win ISO contains VirtIO storage/network drivers and the QEMU
 * guest agent installer, required for Windows template creation.
 *
 * @returns Absolute path to the cached virtio-win ISO
 * @throws Error when the download fails
 *
 * @example
 * ```ts
 * const virtioPath = await ensureVirtioWin();
 * // => /home/user/.local/share/mvm/images/virtio-win.iso
 * ```
 */
export async function ensureVirtioWin(): Promise<string> {
  return downloadIfMissing({
    destPath: join(IMAGES_DIR, VIRTIO_WIN_FILENAME),
    tag: ensureVirtioWin.name,
    url: VIRTIO_WIN_URL,
  });
}

//endregion Image downloads
