/**
 * File open operation.
 *
 * Reads a file from disk and returns its content as a string.
 */

import { readFile, } from 'node:fs/promises';
import { resolve, } from 'node:path';

/**
 * Result of opening a file.
 */
type OpenResult = {
  /** Absolute resolved path. */
  path: string;
  /** Full file content as UTF-8 text. */
  content: string;
};

/**
 * Reads a file from disk and returns its absolute path and content.
 *
 * @param filePath - path to the file (relative paths resolve against cwd)
 *
 * @returns resolved path and file content
 *
 * @throws {Error} when the file cannot be read
 */
export async function openFile(filePath: string,): Promise<OpenResult> {
  const absolutePath = resolve(filePath,);
  const content = await readFile(absolutePath, 'utf8',);
  return { path: absolutePath, content, };
}
