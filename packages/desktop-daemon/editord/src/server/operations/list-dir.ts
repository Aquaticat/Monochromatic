/**
 * Directory listing operation.
 *
 * Reads a directory from disk and returns its entries with type information.
 * Entries are sorted: directories first, then alphabetically within each group.
 */

import { readdir, } from 'node:fs/promises';
import { resolve, } from 'node:path';

/** Single entry in a directory listing. */
type DirEntry = {
  /** File or directory name (no path separator). */
  name: string;
  /** Whether entry is a directory. */
  isDirectory: boolean;
};

/** Result of listing a directory. */
type ListDirResult = {
  /** Absolute resolved path. */
  path: string;
  /** Sorted directory entries (directories first, then alphabetical). */
  entries: DirEntry[];
};

/**
 * Reads a directory from disk and returns its sorted entries.
 *
 * Directories are listed before files. Within each group, entries
 * are sorted alphabetically by name using locale-aware comparison.
 *
 * @param dirPath - path to the directory (relative paths resolve against cwd)
 *
 * @returns resolved path and sorted directory entries
 *
 * @throws when the directory cannot be read
 */
export async function listDir(dirPath: string,): Promise<ListDirResult> {
  const absolutePath = resolve(dirPath,);
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
