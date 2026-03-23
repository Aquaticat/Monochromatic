/**
 * File tree entry utilities.
 *
 * Path helpers, context menu suppression, and preloading
 * for the file tree component.
 */

import type { DirEntry, } from '../../../protocol.ts';

/**
 * Builds the full path for a child entry within a parent directory.
 *
 * @param parentPath - absolute path of the parent directory
 *
 * @param name - child entry name
 *
 * @returns absolute path for the child
 */
export function childPath({ parentPath, name, }: { parentPath: string; name: string }): string {
  return parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
}

/**
 * Fetches direct children of all directory entries concurrently
 * and stores them in the prefetch cache.
 *
 * @param parentPath - absolute path of the parent directory
 *
 * @param entries - directory entries whose subdirectories to preload
 *
 * @param fetchDir - function that fetches directory contents
 *
 * @param prefetchCache - cache map to store preloaded children
 */
export async function preloadChildren({ parentPath, entries, fetchDir, prefetchCache, }: {
  parentPath: string;
  entries: DirEntry[];
  fetchDir: (path: string,) => Promise<DirEntry[]>;
  prefetchCache: Map<string, DirEntry[]>;
}): Promise<void> {
  await Promise.allSettled(
    entries
      .filter(function isDir(entry,) { return entry.isDirectory; },)
      .map(async function prefetchDir(entry,) {
        const fullPath = childPath({ parentPath, name: entry.name, },);
        const children = await fetchDir(fullPath,);
        prefetchCache.set(fullPath, children,);
      },),
  );
}
