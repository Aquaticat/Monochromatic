/**
 * File open operation.
 *
 * Reads a file from disk and returns its content categorized by kind.
 * Media files (image, audio, video) are identified by extension and returned
 * without content (the client fetches them via HTTP). Unknown binaries are
 * detected by null-byte inspection and rendered as a hex dump.
 */

import { readFile, } from 'node:fs/promises';

import type { FileKind, } from '../../protocol.ts';
import { assertWithinRoot, } from './assert-within-root.ts';
import { getMediaKind, } from './file-kind.ts';
import { generateHexDump, } from './hex-dump.ts';

/** Result of opening a file. */
export type OpenResult = {
  /** Content category driving viewer selection. */
  kind: FileKind;
  /** Absolute resolved path. */
  path: string;
  /** File content: UTF-8 text, hex dump, or empty string for media. */
  content: string;
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
export async function openFile({ rootDir, path, }: { rootDir: string; path: string }): Promise<OpenResult> {
  const absolutePath = assertWithinRoot({ rootDir, path, },);

  const mediaKind = getMediaKind({ path, },);
  if (mediaKind !== null) {
    return { kind: mediaKind, path: absolutePath, content: '', };
  }

  const buffer = await readFile(absolutePath,);
  if (buffer.includes(0,)) {
    return { kind: 'binary', path: absolutePath, content: generateHexDump({ buffer, },), };
  }

  return { kind: 'text', path: absolutePath, content: buffer.toString('utf8',), };
}
