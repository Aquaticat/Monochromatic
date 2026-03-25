/**
 * Filesystem create operation.
 *
 * Creates a new file or directory within the root directory.
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Creates a new file or directory inside a parent directory.
 * The resulting path must remain within root.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param parentPath - directory in which to create the entry
 *
 * @param name - name of the new entry (bare filename, no separators)
 *
 * @param isDirectory - whether to create a directory (true) or empty file (false)
 *
 * @throws when the path escapes root, name contains a separator, or the operation fails
 */
export async function newEntry({
  rootDir,
  parentPath,
  name,
  isDirectory,
}: {
  rootDir: string;
  parentPath: string;
  name: string;
  isDirectory: boolean;
},): Promise<void> {
  if (name.includes('/',) || name.includes('\\',))
    throw new Error(`name must be a bare filename, got: ${name}`,);

  const absoluteParent = assertWithinRoot({
    rootDir,
    path: parentPath,
  },);
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
    : writeFile(
      absolutePath,
      '',
      'utf8',
    ));
}
