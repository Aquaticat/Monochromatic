/**
 * Path containment guard for filesystem operations.
 *
 * Ensures that resolved paths stay within the designated root directory,
 * preventing path traversal attacks via `..` or absolute paths outside the tree.
 */

import { resolve, } from 'node:path';

/**
 * Resolves a path and asserts it falls within the root directory.
 *
 * @param rootDir - absolute path to the allowed root
 *
 * @param path - user-supplied path to validate (may be relative)
 *
 * @returns resolved absolute path guaranteed to be within `rootDir`
 *
 * @throws when the resolved path escapes the root directory
 *
 * @example
 * ```ts
 * // Returns '/home/user/project/src/index.ts'
 * assertWithinRoot({ rootDir: '/home/user/project', path: 'src/index.ts' });
 *
 * // Throws: 'path escapes root: /etc/passwd'
 * assertWithinRoot({ rootDir: '/home/user/project', path: '/etc/passwd' });
 * ```
 */
export function assertWithinRoot(
  { rootDir, path, }: { rootDir: string; path: string; },
): string {
  const absolute = resolve(path,);
  /** Trailing separator ensures `/home/userX/...` doesn't match `/home/user`. */
  const rootPrefix = rootDir.endsWith('/',) ? rootDir : `${rootDir}/`;

  if (absolute !== rootDir && !absolute.startsWith(rootPrefix,))
    throw new Error(`path escapes root: ${absolute}`,);

  return absolute;
}
