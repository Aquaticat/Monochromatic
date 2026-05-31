/**
 * File open operation.
 *
 * Reads a file from disk and returns its content categorized by kind.
 * Media files (image, audio, video) are identified by extension and returned
 * without content (the client fetches them via HTTP). Unknown binaries are
 * detected by null-byte inspection and rendered as a hex dump.
 */

import { open as fsOpen, } from 'node:fs/promises';

import type { FileKind, } from '../../protocol.ts';
import { assertWithinRoot, } from './assert-within-root.ts';
import { getMediaKind, } from './file-kind.ts';
import {
  generateHexDump,
  HEX_DUMP_MAX_BYTES,
} from './hex-dump.ts';
import { probeMedia, } from './probe-media.ts';

/**
 * Number of bytes to read for null-byte detection before committing to a full read.
 */
const BINARY_PROBE_SIZE = 8_192;

/**
 * Result of opening a file.
 */
export type OpenResult = {
  /**
   * Content category driving viewer selection.
   */
  readonly kind: FileKind;
  /**
   * Absolute resolved path.
   */
  readonly path: string;
  /**
   * File content: UTF-8 text, hex dump, or empty string for media.
   */
  readonly content: string;
  /**
   * On-disk file size in bytes, available for text and binary kinds.
   */
  readonly size?: number;
  /**
   * Trimmed ffprobe output for media files, omitting version/build header.
   */
  readonly mediaInfo?: string;
};

/**
 * Reads a file from disk and returns its absolute path, content, and kind.
 * Media files are detected by extension; unknown binaries by null-byte inspection.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - path to the file (relative paths resolve against cwd)
 *
 * @returns resolved path, kind, and file content (empty for media)
 *
 * @throws when the path escapes root or the file cannot be read
 *
 * @example
 * ```ts
 * const result = await openFile({ rootDir: '/home/user/project', path: '/home/user/project/src/main.ts', });
 * ```
 */
export async function openFile(
  {
    rootDir,
    path,
  }: {
    readonly rootDir: string;
    readonly path: string;
  },
): Promise<OpenResult> {
  /**
   * Resolved root-rebased path used by every downstream filesystem call.
   */
  const absolutePath = assertWithinRoot({
    rootDir,
    path,
  },);

  /**
   * Null falls through to the binary probe path below.
   */
  const mediaKind = getMediaKind({ path, },);
  if (mediaKind !== null) {
    /**
     * Optional metadata (dimensions, duration); omitted from the response when null.
     */
    const mediaInfo = await probeMedia({ path: absolutePath, },);
    return {
      kind: mediaKind,
      path: absolutePath,
      content: '',
      ...(mediaInfo !== null ? { mediaInfo, } : {}),
    };
  }

  /**
   * Probe first bytes for null to detect binary without reading the entire file.
   */
  await using handle = await fsOpen(absolutePath,);
  /**
   * Holds only the head bytes; reused as the prefix when concatenating the tail later.
   */
  const probe = Buffer.alloc(BINARY_PROBE_SIZE,);
  /**
   * Actual byte count may be less than the buffer for files smaller than the probe size.
   */
  const { bytesRead, } = await handle.read(
    probe,
    0,
    BINARY_PROBE_SIZE,
    0,
  );

  if (probe
    .subarray(
      0,
      bytesRead,
    )
    .includes(0,))
  {
    /**
     * Binary: read only what hex dump needs instead of the entire file.
     */
    const { size, } = await handle.stat();
    /**
     * Capped so very large binaries do not exhaust memory.
     */
    const dumpLimit = Math.min(
      size,
      HEX_DUMP_MAX_BYTES,
    );
    /**
     * Sized to {@link dumpLimit} so the read fits without an extra slice.
     */
    const dumpBuffer = Buffer.alloc(dumpLimit,);
    await handle.read(
      dumpBuffer,
      0,
      dumpLimit,
      0,
    );
    return {
      kind: 'binary',
      path: absolutePath,
      content: generateHexDump({
        buffer: dumpBuffer,
        totalSize: size,
      },),
      size,
    };
  }

  /**
   * Read the remainder from the already-open handle instead of re-reading the full file.
   */
  const { size, } = await handle.stat();
  /**
   * Tail length needed; ≤ 0 means the probe already captured the whole file.
   */
  const remaining = size - bytesRead;
  if (remaining <= 0) {
    return {
      kind: 'text',
      path: absolutePath,
      content: probe
        .subarray(
          0,
          bytesRead,
        )
        .toString('utf8',),
      size,
    };
  }
  /**
   * Concatenated with the probe to form the full file contents.
   */
  const tail = Buffer.alloc(remaining,);
  await handle.read(
    tail,
    0,
    remaining,
    bytesRead,
  );
  return {
    kind: 'text',
    path: absolutePath,
    content: Buffer
      .concat([
        probe.subarray(
          0,
          bytesRead,
        ),
        tail,
      ],)
      .toString('utf8',),
    size,
  };
}
