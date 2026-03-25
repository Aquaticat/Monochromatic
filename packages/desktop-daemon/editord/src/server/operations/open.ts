/**
 * File open operation.
 *
 * Reads a file from disk and returns its content categorized by kind.
 * Media files (image, audio, video) are identified by extension and returned
 * without content (the client fetches them via HTTP). Unknown binaries are
 * detected by null-byte inspection and rendered as a hex dump.
 */

import {
  open as fsOpen,
  readFile,
} from 'node:fs/promises';

import type { FileKind, } from '../../protocol.ts';
import { assertWithinRoot, } from './assert-within-root.ts';
import { getMediaKind, } from './file-kind.ts';
import {
  generateHexDump,
  HEX_DUMP_MAX_BYTES,
} from './hex-dump.ts';
import { probeMedia, } from './probe-media.ts';

/** Number of bytes to read for null-byte detection before committing to a full read. */
const BINARY_PROBE_SIZE = 8_192;

/** Result of opening a file. */
export type OpenResult = {
  /** Content category driving viewer selection. */
  kind: FileKind;
  /** Absolute resolved path. */
  path: string;
  /** File content: UTF-8 text, hex dump, or empty string for media. */
  content: string;
  /** Trimmed ffprobe output for media files, omitting version/build header. */
  mediaInfo?: string;
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
 */
export async function openFile(
  {
    rootDir,
    path,
  }: {
    rootDir: string;
    path: string
  },
): Promise<OpenResult> {
  const absolutePath = assertWithinRoot({
    rootDir,
    path,
  },);

  const mediaKind = getMediaKind({ path, },);
  if (mediaKind !== null) {
    const mediaInfo = await probeMedia({ path: absolutePath, },);
    return {
      kind: mediaKind,
      path: absolutePath,
      content: '',
      ...(mediaInfo !== null ? { mediaInfo, } : {}),
    };
  }

  /** Probe first bytes for null to detect binary without reading the entire file. */
  await using handle = await fsOpen(absolutePath,);
  const probe = Buffer.alloc(BINARY_PROBE_SIZE,);
  const { bytesRead, } = await handle.read(
    probe,
    0,
    BINARY_PROBE_SIZE,
    0,
  );

  if (probe.subarray(
    0,
    bytesRead,
  ).includes(0,)) {
    /** Binary: read only what hex dump needs instead of the entire file. */
    const { size, } = await handle.stat();
    const dumpLimit = Math.min(
      size,
      HEX_DUMP_MAX_BYTES,
    );
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
      content: generateHexDump({ buffer: dumpBuffer, totalSize: size, },),
    };
  }

  const buffer = await readFile(absolutePath,);
  return {
    kind: 'text',
    path: absolutePath,
    content: buffer.toString('utf8',),
  };
}
