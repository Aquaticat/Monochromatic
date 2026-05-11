/**
 * File save operation.
 *
 * Writes content to a file on disk.
 * Validates that the file path is within the allowed root directory.
 * Skips the write when on-disk content already matches, so dev-loop file
 * watchers (e.g. watchexec restarting the server) do not fire on no-op saves.
 */

import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Reads existing file content, returning null when the file is missing or
 * unreadable. Treating both as "different content" so the caller will attempt
 * the write and surface the real error from `writeFile` if any.
 *
 * @param absolutePath - absolute path of the file to read
 *
 * @returns existing content as utf8, or null when unreadable
 */
async function readExistingOrNull(absolutePath: string,): Promise<string | null> {
  try {
    return await readFile(
      absolutePath,
      'utf8',
    );
  }
  catch {
    return null;
  }
}

/**
 * Writes content to a file on disk.
 * Rejects paths that escape the root directory.
 * Skips the write when current on-disk content equals the new content.
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
 *
 * @example
 * ```ts
 * const result = await saveFile({ rootDir: '/home/user/project', path: '/home/user/project/src/main.ts', content: 'const x = 42;', });
 * ```
 */
export async function saveFile(
  {
    rootDir,
    path,
    content,
  }: {
    rootDir: string;
    path: string;
    content: string;
  },
): Promise<string> {
  const absolutePath = assertWithinRoot({
    rootDir,
    path,
  },);
  const existing = await readExistingOrNull(absolutePath,);
  if (existing === content)
    return absolutePath;
  await writeFile(
    absolutePath,
    content,
    'utf8',
  );
  return absolutePath;
}
