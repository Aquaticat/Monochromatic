/**
 * File save operation.
 *
 * Writes content to a file on disk.
 * Validates that the file path is within the allowed root directory.
 */

import { writeFile, } from 'node:fs/promises';

import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Writes content to a file on disk.
 * Rejects paths that escape the root directory.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - path to the file (relative paths resolve against cwd)
 *
 * @param content - full file content to write
 *
 * @returns resolved absolute path (for callers that need it, e.g. watcher suppression)
 *
 * @throws when the path escapes root or the file cannot be written
 */
export async function saveFile(
  {
    rootDir,
    path,
    content,
  }: {
    rootDir: string;
    path: string;
    content: string
  },
): Promise<string> {
  const absolutePath = assertWithinRoot({
    rootDir,
    path,
  },);
  await writeFile(
    absolutePath,
    content,
    'utf8',
  );
  return absolutePath;
}
