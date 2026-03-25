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
export function childPath(
  {
    parentPath,
    name,
  }: {
    parentPath: string;
    name: string
  },
): string {
  return parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
}

/** Maximum number of directory listings to keep in the prefetch cache. */
const MAX_PREFETCH_CACHE_SIZE = 200;

/**
 * Evicts the oldest entries from the prefetch cache when it exceeds the size limit.
 * Map iteration order is insertion order, so the first entries are the oldest.
 *
 * @param cache - prefetch cache map to evict from
 */
function evictPrefetchCache({ cache, }: { cache: Map<string, DirEntry[]>; },): void {
  if (cache.size <= MAX_PREFETCH_CACHE_SIZE)
    return;
  const excess = cache.size - MAX_PREFETCH_CACHE_SIZE;
  let removed = 0;
  for (const key of cache.keys()) {
    if (removed >= excess)
      break;
    cache.delete(key,);
    removed++;
  }
}

/**
 * Fetches direct children of all directory entries concurrently
 * and stores them in the prefetch cache. Evicts oldest entries
 * when the cache exceeds {@link MAX_PREFETCH_CACHE_SIZE}.
 *
 * @param parentPath - absolute path of the parent directory
 *
 * @param entries - directory entries whose subdirectories to preload
 *
 * @param fetchDir - function that fetches directory contents
 *
 * @param prefetchCache - cache map to store preloaded children
 */
export async function preloadChildren({
  parentPath,
  entries,
  fetchDir,
  prefetchCache,
}: {
  parentPath: string;
  entries: DirEntry[];
  fetchDir: (path: string,) => Promise<DirEntry[]>;
  prefetchCache: Map<string, DirEntry[]>;
},): Promise<void> {
  await Promise.allSettled(
    entries
      .filter(function isDir(entry,) {
        return entry.isDirectory;
      },)
      .map(async function prefetchDir(entry,) {
        const fullPath = childPath({
          parentPath,
          name: entry.name,
        },);
        const children = await fetchDir(fullPath,);
        prefetchCache.set(
          fullPath,
          children,
        );
      },),
  );
  evictPrefetchCache({ cache: prefetchCache, },);
}
