/**
 * Directory listing operation.
 *
 * Reads a directory from disk and returns its entries with type information.
 * Entries are sorted: directories first, then alphabetically within each group.
 * Validates that the directory path is within the allowed root directory.
 */

import { readdir, } from 'node:fs/promises';

import type { DirEntry, } from '../../protocol.ts';
import { assertWithinRoot, } from './assert-within-root.ts';

/** Result of listing a directory. */
type ListDirResult = {
  /** Absolute resolved path. */
  path: string;
  /** Sorted directory entries (directories first, then alphabetical). */
  entries: DirEntry[];
};

/**
 * Reads a directory from disk and returns its sorted entries.
 * Rejects paths that escape the root directory.
 *
 * Directories are listed before files. Within each group, entries
 * are sorted alphabetically by name using locale-aware comparison.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - path to the directory (relative paths resolve against cwd)
 *
 * @returns resolved path and sorted directory entries
 *
 * @throws when the path escapes root or the directory cannot be read
 */
export async function listDir({ rootDir, path, }: { rootDir: string; path: string }): Promise<ListDirResult> {
  const absolutePath = assertWithinRoot({ rootDir, path, },);
  const dirents = await readdir(absolutePath, { withFileTypes: true, },);

  /** Directory entries first, then files, both groups alphabetically sorted. */
  const entries: DirEntry[] = dirents
    .map(function toDirEntry(dirent,) {
      return { name: dirent.name, isDirectory: dirent.isDirectory(), };
    },)
    .toSorted(function sortDirsFirst(a, b,) {
      if (a.isDirectory !== b.isDirectory)
        return a.isDirectory ? -1 : 1;

      return a.name.localeCompare(b.name,);
    },);

  return { path: absolutePath, entries, };
}
