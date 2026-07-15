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
 * @returns resolved absolute path, for watcher suppression at the dispatch
 *   layer (the unlink event is self-triggered)
 *
 * @throws when the path escapes root or the delete fails
 *
 * @example
 * ```ts
 * const deleted = await deleteEntry({ rootDir: '/home/user/project', path: '/home/user/project/src/main.ts', });
 * ```
 */
export async function deleteEntry(
  {
    rootDir,
    path,
  }: {
    readonly rootDir: string;
    readonly path: string;
  },
): Promise<string> {
  /**
   * Validated absolute path; throws if the input escapes `rootDir`.
   */
  const absolutePath = assertWithinRoot({
    rootDir,
    path,
  },);

  if (absolutePath === rootDir)
    throw new Error('cannot delete root directory',);

  await rm(
    absolutePath,
    { recursive: true, },
  );

  return absolutePath;
}
