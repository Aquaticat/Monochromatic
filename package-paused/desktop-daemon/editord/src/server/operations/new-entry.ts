/**
 * Filesystem create operation.
 *
 * Creates a new file or directory within the root directory.
 */

import { mkdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import { assertWithinRoot, } from './assert-within-root.ts';
import { writeFileAtomic, } from './write-file-atomic.ts';

/**
 * Creates a new file or directory inside a parent directory.
 * The resulting path must remain within root.
 *
 * File creation goes through {@link writeFileAtomic} so the daemon never
 * leaves a half-created file behind on crash; directory creation is a
 * single `mkdir` syscall, which is already atomic.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param parentPath - directory in which to create the entry
 *
 * @param name - name of the new entry (bare filename, no separators)
 *
 * @param isDirectory - whether to create a directory (true) or empty file (false)
 *
 * @returns absolute path of the created entry, for watcher suppression at the dispatch layer
 *
 * @throws when the path escapes root, name contains a separator, or the operation fails
 *
 * @example
 * ```ts
 * const created = await newEntry({ rootDir: '/home/user/project', parentPath: 'src', name: 'utils.ts', isDirectory: false, });
 * ```
 */
export async function newEntry({
  rootDir,
  parentPath,
  name,
  isDirectory,
}: {
  readonly rootDir: string;
  readonly parentPath: string;
  readonly name: string;
  readonly isDirectory: boolean;
},): Promise<string> {
  if (name.includes('/',)
    || name
    .includes('\\',))
    throw new Error(`name must be a bare filename, got: ${name}`,);

  /**
   * Parent rebased through `assertWithinRoot` so `path/..` cannot escape the root.
   */
  const absoluteParent = assertWithinRoot({
    rootDir,
    path: parentPath,
  },);
  /**
   * Joined child path, re-verified against the root below.
   */
  const absolutePath = join(
    absoluteParent,
    name,
  );
  assertWithinRoot({
    rootDir,
    path: absolutePath,
  },);

  await (isDirectory
    ? mkdir(absolutePath,)
    : writeFileAtomic({
      path: absolutePath,
      content: '',
    },));

  return absolutePath;
}
