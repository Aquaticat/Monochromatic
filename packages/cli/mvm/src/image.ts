import { existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
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
 * Prints download progress to stderr by polling the destination file size
 * while a concurrent `Bun.write()` streams the response to disk.
 * Resolves when the write completes; rejects if it fails.
 *
 * Uses `Bun.write(destPath, response)` for native-speed I/O instead of
 * manual chunk-by-chunk streaming, which avoids throughput bottlenecks
 * and buffering bugs in the JS `ReadableStream` path.
 *
 * @param options - Response to write, destination file path, and logger instance
 *
 * @example
 * ```ts
 * await writeWithProgress({ response, destPath: '/tmp/image.img', rl: logger });
 * ```
 */
async function writeWithProgress({ destPath, response, rl }: {
  destPath: string;
  response: Response;
  rl: { info: (msg: string) => void };
}): Promise<void> {
  const contentLength = Number(response.headers.get('content-length') ?? 0);
  const totalStr = contentLength > 0 ? formatBytes(contentLength) : 'unknown';

  /** Milliseconds between file size polls for progress display. */
  const POLL_INTERVAL_MS = 500;

  let done = false;

  // Poll file size in the background for progress reporting
  const progressLoop = (async () => {
    while (!done) {
      await Bun.sleep(POLL_INTERVAL_MS);
      if (done) break;
      try {
        const { size } = await stat(destPath);
        const downloadedStr = formatBytes(size);
        if (contentLength > 0) {
          const pct = Math.round((size / contentLength) * 100);
          process.stderr.write(`\r  downloading: ${downloadedStr} / ${totalStr} (${String(pct)}%)`);
        } else {
          process.stderr.write(`\r  downloading: ${downloadedStr}`);
        }
      } catch {
        // File may not exist yet during initial write setup
      }
    }
  })();

  // Native Bun.write streams the response body to disk at full speed
  await Bun.write(destPath, response);
  done = true;
  await progressLoop;

  const { size } = await stat(destPath);
  process.stderr.write(`\r  downloaded: ${formatBytes(size)} total${' '.repeat(20)}\n`);
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

  await writeWithProgress({ destPath, response, rl });
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
