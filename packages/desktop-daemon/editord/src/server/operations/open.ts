/**
 * File open operation.
 *
 * Reads a file from disk and returns its content as a string.
 * Validates that the file path is within the allowed root directory.
 */

import { readFile, } from 'node:fs/promises';

import { assertWithinRoot, } from './assert-within-root.ts';

/** Result of opening a file. */
type OpenResult = {
  /** Absolute resolved path. */
  path: string;
  /** Full file content as UTF-8 text. */
  content: string;
};

/**
 * Reads a file from disk and returns its absolute path and content.
 * Rejects paths that escape the root directory.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - path to the file (relative paths resolve against cwd)
 *
 * @returns resolved path and file content
 *
 * @throws when the path escapes root or the file cannot be read
 */
export async function openFile({ rootDir, path, }: { rootDir: string; path: string }): Promise<OpenResult> {
  const absolutePath = assertWithinRoot({ rootDir, path, },);
  const content = await readFile(absolutePath, 'utf8',);
  return { path: absolutePath, content, };
}
