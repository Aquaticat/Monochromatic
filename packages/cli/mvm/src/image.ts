import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  IMAGES_DIR,
  UBUNTU_IMAGE_NAME,
  UBUNTU_IMAGE_URL,
} from './config.ts';
import { l, tagged } from './log.ts';

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
  const MIB = 1_024 * 1_024;
  if (bytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)} MiB`;
  }
  const KIB = 1_024;
  return `${(bytes / KIB).toFixed(0)} KiB`;
}

/**
 * Streams a fetch response body to a file while printing download progress to stderr.
 * Overwrites the same line using carriage return for a clean progress display.
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
  const {body} = response;
  if (body === null) {
    throw new Error('response body is null');
  }

  const contentLength = Number(response.headers.get('content-length') ?? 0);
  const totalStr = contentLength > 0 ? formatBytes(contentLength) : 'unknown';
  let downloaded = 0;
  const chunks: Uint8Array[] = [];

  const reader = body.getReader();
  let lastProgressTime = 0;
  /** Minimum milliseconds between progress line updates to avoid flickering. */
  const PROGRESS_THROTTLE_MS = 250;

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- reader.read() loop
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
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

  process.stderr.write(`\r  downloaded: ${formatBytes(downloaded)} total${' '.repeat(20)}\n`);

  const result = new Uint8Array(downloaded);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  await writeFile(destPath, result);
  rl.info(`saved to ${destPath}`);
}

/**
 * Ensures the Ubuntu cloud image is cached locally, downloading it if missing.
 * Shows download progress on stderr when fetching.
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

  rl.info(`downloading Ubuntu 24.04 LTS cloud image to ${IMAGES_DIR}`);
  await mkdir(IMAGES_DIR, { recursive: true, });

  const response = await fetch(UBUNTU_IMAGE_URL);
  if (!response.ok) {
    throw new Error(`failed to download image: ${response.status} ${response.statusText}`);
  }

  await streamWithProgress({ destPath: imagePath, response, rl, });
  return imagePath;
}
