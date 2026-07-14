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
 *
 * @example
 * ```ts
 * const result = childPath({ parentPath: '/home/user/project/src/main.ts', name: 'utils.ts', });
 * ```
 */
export function childPath(
  {
    parentPath,
    name,
  }: {
    readonly parentPath: string;
    readonly name: string;
  },
): string {
  return parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;
}

/**
 * Builds a Map from file path to recency index for O(1) lookups.
 *
 * Without this, each file entry would call `recentPaths.indexOf(path)`
 * making the whole loop O(entries * recentPaths). The Map brings it
 * down to O(entries + recentPaths).
 *
 * @param recentPaths - ordered list of recently opened file paths
 *
 * @returns map from path to its index in the recency list
 *
 * @example
 * ```ts
 * const result = buildRecencyIndex({ recentPaths: '/home/user/project/src/main.ts', });
 * ```
 */
export function buildRecencyIndex(
  { recentPaths, }: { readonly recentPaths: readonly string[]; },
): Map<string, number> {
  /**
   * Position-keyed map; lower index means more recent.
   */
  const index = new Map<string, number>();
  recentPaths.forEach(function indexRecent(
    path,
    i,
  ) {
    index.set(
      path,
      i,
    );
  },);
  return index;
}

/**
 * Maximum number of directory listings to keep in the prefetch cache.
 */
const MAX_PREFETCH_CACHE_SIZE = 200;

/**
 * Directory-name suffixes that strongly imply a short-lived, race-prone directory:
 * - `.lock`: `proper-lockfile`-style atomic lock dirs (created via `mkdir`,
 *   removed on release; observed continuously for `~/.claude.json.lock`).
 * - `.tmp` / `.temp`: common transient-temp conventions.
 *
 * Listed once at module scope so the predicate stays cheap inside the loop.
 */
const TRANSIENT_DIR_SUFFIXES = [
  '.lock',
  '.tmp',
  '.temp',
] as const;

/**
 * Returns whether a directory name matches a known transient-dir shape.
 * Used by the speculative prefetch to skip directories that are likely to
 * have already been removed by the time the prefetch listing reaches the
 * server, which would otherwise produce ENOENT noise.
 *
 * @param name - directory entry name (basename, not full path)
 *
 * @returns true when the name ends with a known transient suffix
 *
 * @example
 * ```ts
 * isTransientDirName({ name: '.claude.json.lock', }); // true
 * isTransientDirName({ name: 'src', }); // false
 * ```
 */
function isTransientDirName({ name, }: { readonly name: string; },): boolean {
  return TRANSIENT_DIR_SUFFIXES.some(
    function endsWithSuffix(suffix,) {
      return name.endsWith(suffix,);
    },
  );
}

/**
 * Evicts the oldest entries from the prefetch cache when it exceeds the size limit.
 * Map iteration order is insertion order, so the first entries are the oldest.
 *
 * @param cache - prefetch cache map to evict from
 */
function evictPrefetchCache({ cache, }: { readonly cache: Map<string, readonly DirEntry[]>; },): void {
  if (cache.size
    <= MAX_PREFETCH_CACHE_SIZE)
    return;
  /**
   * Number of oldest entries to drop so the cache returns under cap.
   */
  const excess = cache.size
    - MAX_PREFETCH_CACHE_SIZE;
  /**
   * First-N keys in insertion order; Maps preserve insertion order, so
   * slicing here selects the oldest entries to evict.
   */
  const keysToEvict = [...cache.keys(),].slice(
    0,
    excess,
  );
  for (const key of keysToEvict)
    cache.delete(key,);
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
 *
 * @example
 * ```ts
 * await preloadChildren({ parentPath: '/home/user/project/src/main.ts', entries: dirEntries, fetchDir: function handleFetchDir() { l.info("done"); }, prefetchCache: new Map(), });
 * ```
 */
export async function preloadChildren({
  parentPath,
  entries,
  fetchDir,
  prefetchCache,
}: {
  readonly parentPath: string;
  readonly entries: readonly DirEntry[];
  readonly fetchDir: (path: string,) => Promise<readonly DirEntry[]>;
  readonly prefetchCache: Map<string, readonly DirEntry[]>;
},): Promise<void> {
  await Promise.allSettled(
    entries
      .filter(function isDir(entry,) {
        return entry.isDirectory;
      },)
      .filter(function isNotTransient(entry,) {
        return !isTransientDirName({ name: entry.name, },);
      },)
      .map(async function prefetchDir(entry,) {
        /**
         * Joined parent + entry name; cache key for the prefetched listing.
         */
        const fullPath = childPath({
          parentPath,
          name: entry.name,
        },);
        /**
         * Listing stored under {@link fullPath} for the next on-demand expansion.
         */
        const children = await fetchDir(fullPath,);
        prefetchCache.set(
          fullPath,
          children,
        );
      },),
  );
  evictPrefetchCache({ cache: prefetchCache, },);
}
