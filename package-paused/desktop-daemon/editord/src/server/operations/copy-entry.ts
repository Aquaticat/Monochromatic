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
 * @returns resolved absolute destination path, for watcher suppression at the
 *   dispatch layer (the add event at the destination is self-triggered;
 *   the source is unchanged so no source-side suppression is needed)
 *
 * @throws when either path escapes root or the copy fails
 *
 * @example
 * ```ts
 * const copied = await copyEntry({ rootDir: '/home/user/project', path: '/home/user/project/src/main.ts', destPath: '/home/user/project/src/renamed.ts', });
 * ```
 */
export async function copyEntry(
  {
    rootDir,
    path,
    destPath,
  }: {
    readonly rootDir: string;
    readonly path: string;
    readonly destPath: string;
  },
): Promise<string> {
  /**
   * Validated absolute source path; throws if the input escapes `rootDir`.
   */
  const absoluteSource = assertWithinRoot({
    rootDir,
    path,
  },);
  /**
   * Validated absolute destination path; throws if the input escapes `rootDir`.
   */
  const absoluteDest = assertWithinRoot({
    rootDir,
    path: destPath,
  },);

  await cp(
    absoluteSource,
    absoluteDest,
    { recursive: true, },
  );

  return absoluteDest;
}
