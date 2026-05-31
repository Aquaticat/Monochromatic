/**
 * Project root discovery for LSP servers.
 *
 * Walks up from a starting directory to find the nearest ancestor
 * containing one of the specified config files.
 * Results are cached with a TTL so new config files are picked up
 * without restarting the server.
 */

import { existsSync, } from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';

/**
 * Cache entry with a timestamp for TTL-based eviction.
 */
type CacheEntry = {
  /**
   * Cached result: project root path or null.
   */
  readonly value: string | null;
  /**
   * Timestamp when the entry was stored (milliseconds since epoch).
   */
  readonly storedAt: number;
};

/**
 * Time-to-live for cache entries (milliseconds).
 */
const CACHE_TTL_MS = 60_000;

/**
 * Cached results keyed by `"startDir\0ceiling\0file1\0file2"`.
 * Entries expire after {@link CACHE_TTL_MS} so newly created
 * config files are picked up without restarting the server.
 */
const rootCache = new Map<string, CacheEntry>();

/**
 * Pre-computed join suffix for each config file list.
 * Avoids re-joining the same static array on every lookup.
 */
const joinedConfigFilesCache = new WeakMap<readonly string[], string>();

/**
 * Returns a cached `\0`-joined string for a config file list.
 * Since CONFIG_FILES values are static frozen arrays, this runs
 * the join at most once per server type.
 *
 * @param configFiles - config file names to join
 *
 * @returns null-separated string of file names
 */
function getJoinedConfigFiles(configFiles: readonly string[],): string {
  /**
   * Cached joined form; avoids re-joining when the same array is reused.
   */
  const cached = joinedConfigFilesCache.get(configFiles,);
  if (cached !== undefined)
    return cached;
  /**
   * Null byte cannot appear in filenames, so it is safe as a delimiter.
   */
  const joined = configFiles.join('\0',);
  joinedConfigFilesCache.set(
    configFiles,
    joined,
  );
  return joined;
}

/**
 * Finds the nearest ancestor directory containing one of the config files.
 * Stops walking at `ceiling` to prevent scanning above the file tree root.
 *
 * @param startDir - directory to start searching from
 *
 * @param configFiles - filenames to look for (e.g. `['tsconfig.json']`)
 *
 * @param ceiling - highest directory to search (inclusive); stops before going higher
 *
 * @returns absolute path to the project root, or null if none found
 *
 * @example
 * ```ts
 * findProjectRoot({ startDir: '/home/user/repo/src', configFiles: ['tsconfig.json'], ceiling: '/home/user' });
 * // '/home/user/repo'
 * ```
 */
export function findProjectRoot({
  startDir,
  configFiles,
  ceiling,
}: {
  readonly startDir: string;
  readonly configFiles: readonly string[];
  readonly ceiling: string;
},): string | null {
  /**
   * Composite key encodes startDir, ceiling, and the joined config-file set.
   */
  const cacheKey = `${startDir}\0${ceiling}\0${getJoinedConfigFiles(configFiles,)}`;
  /**
   * TTL-gated reuse below avoids hitting the filesystem for recently-resolved paths.
   */
  const cached = rootCache.get(cacheKey,);
  if ((cached !== undefined) && ((Date.now()
    - cached
    .storedAt) < CACHE_TTL_MS))
    return cached.value;

  /**
   * Walks upward from {@link startDir}; mutated by the loop body.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- directory-walk cursor: `dir` rises via `dirname` each iteration until ceiling or filesystem root
  let dir = startDir;
  while (true) {
    for (const file of configFiles) {
      if (existsSync(join(
        dir,
        file,
      ),)) {
        rootCache.set(
          cacheKey,
          {
            value: dir,
            storedAt: Date.now(),
          },
        );
        return dir;
      }
    }
    /**
     * Stop if we've reached the ceiling or filesystem root.
     */
    if (dir === ceiling)
      break;
    /**
     * Same-as-self means we hit the filesystem root; break to avoid infinite loop.
     */
    const parent = dirname(dir,);
    if (parent === dir)
      break;
    dir = parent;
  }

  rootCache.set(
    cacheKey,
    {
      value: null,
      storedAt: Date.now(),
    },
  );
  return null;
}
