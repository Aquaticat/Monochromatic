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
 * @returns resolved absolute source and destination paths, for watcher
 *   suppression at the dispatch layer (the source's unlink and the
 *   destination's add are both self-triggered)
 *
 * @throws when either path escapes root or the move fails
 *
 * @example
 * ```ts
 * const { source, dest, } = await moveEntry({ rootDir: '/home/user/project', path: '/home/user/project/src/main.ts', destPath: '/home/user/project/src/renamed.ts', });
 * ```
 */
export async function moveEntry(
  {
    rootDir,
    path,
    destPath,
  }: {
    readonly rootDir: string;
    readonly path: string;
    readonly destPath: string;
  },
): Promise<{
  readonly source: string;
  readonly dest: string;
}> {
  /**
   * Source rebased so `path/..` cannot escape the root.
   */
  const absoluteSource = assertWithinRoot({
    rootDir,
    path,
  },);
  /**
   * Dest rebased so the move target stays within the root.
   */
  const absoluteDest = assertWithinRoot({
    rootDir,
    path: destPath,
  },);

  await rename(
    absoluteSource,
    absoluteDest,
  );

  return {
    source: absoluteSource,
    dest: absoluteDest,
  };
}
