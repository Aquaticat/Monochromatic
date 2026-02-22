import { resolve, } from 'node:path';

/**
 * In-memory cache of file content keyed by absolute path.
 * Persists across config re-runs (not cleared by `reset()`).
 * Watch mode invalidates specific entries when it knows which file changed,
 * so subsequent `readCached()` calls re-read only the invalidated files.
 */
export const readCache: Map<string, string> = new Map();

/**
 * Removes specific paths from the read cache so the next `readCached()`
 * call re-reads them from disk. Called by watch mode with the path that
 * triggered the filesystem event -- all other cached entries stay valid.
 * @param paths - File paths to invalidate (resolved to absolute internally)
 */
export function invalidatePaths(paths: readonly string[]): void {
  paths.forEach((filePath) => readCache.delete(resolve(filePath)));
}

/**
 * Reads a file, returning the cached content if available.
 * On cache miss, reads from disk and stores the result.
 * @param filePath - Path to read (resolved to absolute for cache key)
 * @returns File content as a string
 */
export async function readCached(filePath: string): Promise<string> {
  /** Absolute path used as the cache key for reliable lookups */
  const absPath = resolve(filePath);
  const cached = readCache.get(absPath);
  if (cached !== undefined) {
    return cached;
  }
  const content = await Bun.file(absPath).text();
  readCache.set(absPath, content);
  return content;
}

/**
 * Updates the cache entry for a file after writing new content.
 * Avoids a redundant disk read on the next `readCached()` call
 * for files we just wrote ourselves.
 * @param filePath - Path that was written (resolved to absolute internally)
 * @param content - Content that was written to the file
 */
export function updateCache(filePath: string, content: string): void {
  readCache.set(resolve(filePath), content);
}
