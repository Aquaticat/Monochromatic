import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { IMAGES_DIR } from './config.ts';
import { l, tagged } from './log.ts';
import { VIRTIO_WIN_FILENAME, VIRTIO_WIN_URL, type ImageSpec } from './registry.ts';

//region Byte size formatting constants

/** Bytes per kibibyte. */
const KIB = 1_024;

/** Bytes per mebibyte. */
const MIB = KIB * KIB;

/** Bytes per gibibyte. */
const GIB = KIB * KIB * KIB;

/** Multiplier for converting a ratio to a percentage. */
const PERCENT = 100;

/** Number of trailing spaces to overwrite stale progress line characters. */
const PROGRESS_LINE_PAD = 20;

//endregion Byte size formatting constants

//region Download progress

/**
 * Formats a byte count as a human-readable string (e.g. "123.4 MiB").
 *
 * @param bytes - Raw byte count
 *
 * @returns Formatted string with appropriate unit
 *
 * @example
 * ```ts
 * formatBytes(1_048_576); // => "1.0 MiB"
 * ```
 */
function formatBytes(bytes: number): string {
  if (bytes >= GIB) {
    return `${(bytes / GIB).toFixed(1)} GiB`;
  }
  if (bytes >= MIB) {
    return `${(bytes / MIB).toFixed(1)} MiB`;
  }
  return `${(bytes / KIB).toFixed(0)} KiB`;
}

/**
 * Polls the destination file size and prints download progress to stderr.
 * Runs until the `signal` is aborted by the caller after the download completes.
 *
 * @param destPath - Destination file path being written to
 *
 * @param contentLength - Expected total bytes (0 when unknown)
 *
 * @param totalStr - Pre-formatted total size string for display
 *
 * @param signal - AbortSignal that stops the polling loop
 *
 * @returns Resolves when polling stops
 */
async function pollProgress(destPath: string, contentLength: number, totalStr: string, signal: AbortSignal): Promise<void> {
  /** Milliseconds between file size polls for progress display. */
  const POLL_INTERVAL_MS = 500;

  while (!signal.aborted) {
    // oxlint-disable-next-line eslint(no-await-in-loop), eslint-plugin-promise(avoid-new) -- deliberate serial polling loop
    await new Promise(function pollDelay(resolve) { setTimeout(resolve, POLL_INTERVAL_MS); });
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- signal can be aborted during the await above
    if (signal.aborted) break;
    try {
      // oxlint-disable-next-line eslint(no-await-in-loop) -- deliberate serial polling loop
      const { size } = await stat(destPath);
      const downloadedStr = formatBytes(size);
      if (contentLength > 0) {
        const pct = Math.round((size / contentLength) * PERCENT);
        process.stderr.write(`\r  downloading: ${downloadedStr} / ${totalStr} (${String(pct)}%)`);
      } else {
        process.stderr.write(`\r  downloading: ${downloadedStr}`);
      }
    } catch {
      // File may not exist yet during initial write setup
    }
  }
}

/**
 * Streams a fetch response body to disk while printing download progress to stderr.
 * Uses AbortController to coordinate between the progress poller and the stream pipeline.
 *
 * @param destPath - Destination file path to write to
 *
 * @param response - Fetch response with a body to stream
 *
 * @param rl - Logger for status messages
 *
 * @returns Resolves when the download and progress display are complete
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

  const controller = new AbortController();

  // Start progress polling in the background
  const progressDone = pollProgress(destPath, contentLength, totalStr, controller.signal);

  // Stream response body to disk via AsyncIterable protocol (runtime-neutral)
  const {body} = response;
  if (body === null) {
    controller.abort();
    await progressDone;
    throw new Error(`response body is null for ${destPath}`);
  }
  await pipeline(Readable.from(body), createWriteStream(destPath));

  // Stop progress polling
  controller.abort();
  await progressDone;

  const { size } = await stat(destPath);
  process.stderr.write(`\r  downloaded: ${formatBytes(size)} total${' '.repeat(PROGRESS_LINE_PAD)}\n`);
  rl.info(`saved to ${destPath}`);
}

//endregion Download progress

//region Generic download

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
export function ensureImage(spec: ImageSpec): Promise<string> {
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
    destPath: join(IMAGES_DIR, VIRTIO_WIN_FILENAME),
    tag: ensureVirtioWin.name,
    url: VIRTIO_WIN_URL,
  });
}

//endregion Image downloads
