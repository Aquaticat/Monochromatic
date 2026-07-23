import { dirname, } from 'node:path';

/**
 * Yields a starting directory and every parent through the filesystem root.
 *
 * @param startDirectory - First inclusive directory in the upward walk.
 *
 * @returns root-inclusive directory iterator ordered nearest to farthest.
 *
 * @example
 * ```ts
 * [...ancestorDirectories('/repo/package/src')];
 * // => ['/repo/package/src', '/repo/package', '/repo', '/']
 * ```
 */
export function* ancestorDirectories(
  startDirectory: string,
): Generator<string, void, undefined> {
  /**
   * Root-inclusive cursor whose pending flag becomes false after yielding root.
   */
  const cursor = {
    current: startDirectory,
    pending: true,
  };
  while (cursor.pending) {
    /**
     * Directory yielded during current iteration.
     */
    const { current, } = cursor;
    yield current;
    /**
     * Parent used both as next candidate and root-identity check.
     */
    const parent = dirname(current,);
    cursor.pending = parent !== current;
    cursor.current = parent;
  }
}
