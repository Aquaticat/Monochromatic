/**
 * Filesystem copy operation.
 *
 * Copies a file or directory (recursively) within the root directory.
 */

import { cp, } from 'node:fs/promises';

import { assertWithinRoot, } from './assert-within-root.ts';

/**
 * Copies a file or directory recursively to a new destination.
 * Both source and destination must remain within root.
 *
 * @param rootDir - absolute root directory for path containment
 *
 * @param path - source path to copy from
 *
 * @param destPath - destination path to copy to
 *
 * @throws when either path escapes root or the copy fails
 */
export async function copyEntry(
  { rootDir, path, destPath, }: { rootDir: string; path: string; destPath: string; },
): Promise<void> {
  const absoluteSource = assertWithinRoot({ rootDir, path, },);
  const absoluteDest = assertWithinRoot({ rootDir, path: destPath, },);

  await cp(absoluteSource, absoluteDest, { recursive: true, },);
}
