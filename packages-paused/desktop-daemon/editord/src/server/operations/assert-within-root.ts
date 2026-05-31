/**
 * Path containment guard for filesystem operations.
 *
 * Ensures that resolved paths stay within the designated root directory,
 * preventing path traversal attacks via `..` or absolute paths outside the tree.
 */

import { resolve, } from 'node:path';

/**
 * Tests whether an absolute path is within the given root directory.
 *
 * @param root - absolute root directory path
 *
 * @param path - absolute path to test
 *
 * @returns true when `path` equals `root` or is a descendant of it
 *
 * @example
 * ```ts
 * const result = isWithinRoot({ root: '/home/user/project', path: '/home/user/project/src/main.ts', });
 * ```
 */
export function isWithinRoot({
  root,
  path,
}: {
  readonly root: string;
  readonly path: string;
},): boolean {
  /**
   * Trailing separator ensures `/home/userX/...` doesn't match `/home/user`.
   */
  const rootPrefix = root.endsWith('/',) ? root : `${root}/`;
  return (path === root) || path
    .startsWith(rootPrefix,);
}

/**
 * Resolves a path and asserts it falls within the root directory.
 *
 * Relative paths resolve against `process.cwd()` (which is always inside rootDir at runtime), not against rootDir. Pass an absolute path for unambiguous semantics.
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
 *
 * @example
 * ```ts
 * // Absolute path: unambiguous regardless of cwd.
 * assertWithinRoot({ rootDir: '/home/user/project', path: '/home/user/project/src/index.ts' });
 * ```
 */
export function assertWithinRoot(
  {
    rootDir,
    path,
  }: {
    readonly rootDir: string;
    readonly path: string;
  },
): string {
  /**
   * Canonicalised path; resolves `..` segments before the containment check.
   */
  const absolute = resolve(path,);

  if (!isWithinRoot({
    root: rootDir,
    path: absolute,
  },)) {
    throw new Error(`path escapes root: ${absolute}`,);
  }

  return absolute;
}
