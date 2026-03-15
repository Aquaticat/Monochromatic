/**
 * Download progress display for image downloads.
 *
 * Polls the destination file size and prints progress to stderr.
 *
 * @module
 */

import { createWriteStream, } from 'node:fs';
import { stat, } from 'node:fs/promises';
import { Readable, } from 'node:stream';
import { pipeline, } from 'node:stream/promises';

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
export function formatBytes(bytes: number,): string {
  if (bytes >= GIB)
    return `${(bytes / GIB).toFixed(1,)} GiB`;
  if (bytes >= MIB)
    return `${(bytes / MIB).toFixed(1,)} MiB`;
  return `${(bytes / KIB).toFixed(0,)} KiB`;
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
 */
async function pollProgress(destPath: string, contentLength: number, totalStr: string,
  signal: AbortSignal,): Promise<void>
{
  /** Milliseconds between file size polls for progress display. */
  const POLL_INTERVAL_MS = 500;

  while (!signal.aborted) {
    // oxlint-disable-next-line no-await-in-loop, promise/avoid-new -- deliberate serial polling loop
    await new Promise(function pollDelay(resolve,) {
      setTimeout(resolve, POLL_INTERVAL_MS,);
    },);
    // oxlint-disable-next-line typescript/no-unnecessary-condition -- signal can be aborted during the await above
    if (signal.aborted)
      break;
    try {
      // oxlint-disable-next-line no-await-in-loop -- deliberate serial polling loop
      const { size, } = await stat(destPath,);
      const downloadedStr = formatBytes(size,);
      if (contentLength > 0) {
        const pct = Math.round((size / contentLength) * PERCENT,);
        process.stderr.write(
          `\r  downloading: ${downloadedStr} / ${totalStr} (${String(pct,)}%)`,
        );
      }
      else {
        process.stderr.write(`\r  downloading: ${downloadedStr}`,);
      }
    }
    catch {
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
 * @example
 * ```ts
 * await writeWithProgress({ response, destPath: '/tmp/image.img', rl: logger });
 * ```
 */
export async function writeWithProgress({ destPath, response, rl, }: {
  destPath: string;
  response: Response;
  rl: { info: (msg: string,) => void; };
},): Promise<void> {
  const contentLength = Number(response.headers.get('content-length',) ?? 0,);
  const totalStr = contentLength > 0 ? formatBytes(contentLength,) : 'unknown';

  const controller = new AbortController();

  // Start progress polling in the background
  const progressDone = pollProgress(destPath, contentLength, totalStr,
    controller.signal,);

  // Stream response body to disk via AsyncIterable protocol (runtime-neutral)
  const { body, } = response;
  if (body === null) {
    controller.abort();
    await progressDone;
    throw new Error(`response body is null for ${destPath}`,);
  }
  await pipeline(Readable.from(body,), createWriteStream(destPath,),);

  // Stop progress polling
  controller.abort();
  await progressDone;

  const { size, } = await stat(destPath,);
  process.stderr.write(
    `\r  downloaded: ${formatBytes(size,)} total${' '.repeat(PROGRESS_LINE_PAD,)}\n`,
  );
  rl.info(`saved to ${destPath}`,);
}
