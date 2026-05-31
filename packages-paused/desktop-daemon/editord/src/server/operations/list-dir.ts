/**
 * Directory listing operation.
 *
 * Reads a directory from disk and returns its entries with type information.
 * Entries are returned in filesystem order (readdir order).
 * Validates that the directory path is within the allowed root directory.
 */

import { readdir, } from 'node:fs/promises';

import type { DirEntry, } from '../../protocol.ts';
import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Result of listing a directory.
 */
type ListDirResult = {
  /**
   * Absolute resolved path.
   */
  readonly path: string;
  /**
   * Directory entries in filesystem order.
   */
  readonly entries: readonly DirEntry[];
};

/**
 * Reads a directory from disk and returns its entries in filesystem order.
 * Rejects paths that escape the root directory.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - path to the directory (relative paths resolve against cwd)
 *
 * @returns resolved path and directory entries
 *
 * @throws when the path escapes root or the directory cannot be read
 *
 * @example
 * ```ts
 * const result = await listDir({ rootDir: '/home/user/project', path: '/home/user/project/src/main.ts', });
 * ```
 */
export async function listDir(
  {
    rootDir,
    path,
  }: {
    readonly rootDir: string;
    readonly path: string;
  },
): Promise<ListDirResult> {
  /**
   * Absolute resolved path; throws when `path` escapes `rootDir`, gating the readdir below.
   */
  const absolutePath = assertWithinRoot({
    rootDir,
    path,
  },);
  /**
   * Raw Dirent results from Node; mapped to the wire shape below to drop unrelated fields.
   */
  const dirents = await readdir(
    absolutePath,
    { withFileTypes: true, },
  );

  /**
   * Wire-format entries with just `name` and `isDirectory`; client does not need stat data.
   */
  const entries: DirEntry[] = dirents.map(function toDirEntry(dirent,) {
    return {
      name: dirent.name,
      isDirectory: dirent.isDirectory(),
    };
  },);

  return {
    path: absolutePath,
    entries,
  };
}
