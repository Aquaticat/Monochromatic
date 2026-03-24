/**
 * Project root discovery for LSP servers.
 *
 * Walks up from a starting directory to find the nearest ancestor
 * containing one of the specified config files.
 * Results are cached so repeated lookups from the same directory
 * resolve instantly without filesystem access.
 */

import { existsSync, } from 'node:fs';
import {
  dirname,
  join,
} from 'node:path';

/**
 * Cached results keyed by `"startDir\0file1\0file2"`.
 * Value is the found root directory or `null`.
 */
const rootCache = new Map<string, string | null>();

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
export function findProjectRoot({ startDir, configFiles, ceiling, }: {
  startDir: string;
  configFiles: readonly string[];
  ceiling: string;
},): string | null {
  const cacheKey = `${startDir}\0${ceiling}\0${configFiles.join('\0',)}`;
  const cached = rootCache.get(cacheKey,);
  if (cached !== undefined)
    return cached;

  let dir = startDir;
  while (true) {
    for (const file of configFiles) {
      if (existsSync(join(dir, file,),)) {
        rootCache.set(cacheKey, dir,);
        return dir;
      }
    }
    /** Stop if we've reached the ceiling or filesystem root. */
    if (dir === ceiling)
      break;
    const parent = dirname(dir,);
    if (parent === dir)
      break;
    dir = parent;
  }

  rootCache.set(cacheKey, null,);
  return null;
}
