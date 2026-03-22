/**
 * Filesystem delete operation.
 *
 * Removes a file or directory (recursively) within the root directory.
 */

import { rm, } from 'node:fs/promises';

import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Deletes a file or directory recursively.
 * Rejects paths that escape the root directory.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - path to the entry to delete
 *
 * @throws when the path escapes root or the delete fails
 */
export async function deleteEntry({ rootDir, path, }: { rootDir: string; path: string }): Promise<void> {
  const absolutePath = assertWithinRoot({ rootDir, path, },);

  if (absolutePath === rootDir)
    throw new Error('cannot delete root directory',);

  await rm(absolutePath, { recursive: true, },);
}
