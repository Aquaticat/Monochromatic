/**
 * Filesystem move operation.
 *
 * Moves a file or directory within the root directory.
 */

import { rename, } from 'node:fs/promises';

import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Moves a file or directory to a new path.
 * Both source and destination must remain within root.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - source path to move from
 *
 * @param destPath - destination path to move to
 *
 * @throws when either path escapes root or the move fails
 */
export async function moveEntry(
  {
    rootDir,
    path,
    destPath,
  }: {
    rootDir: string;
    path: string;
    destPath: string
  },
): Promise<void> {
  const absoluteSource = assertWithinRoot({
    rootDir,
    path,
  },);
  const absoluteDest = assertWithinRoot({
    rootDir,
    path: destPath,
  },);

  await rename(
    absoluteSource,
    absoluteDest,
  );
}
