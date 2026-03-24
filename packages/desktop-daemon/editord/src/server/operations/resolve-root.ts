/**
 * Root directory resolution for the file tree.
 *
 * Walks up from the current working directory to find the highest
 * ancestor directory that the process has write permission for.
 * Write permission ensures the editor can create and save files
 * within the tree root.
 */

import {
  access,
  constants,
} from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';

/**
 * Collects all ancestor directory paths from a starting path up to the filesystem root.
 *
 * @param start - absolute path to start from
 *
 * @returns ancestor paths ordered from nearest parent to filesystem root
 */
function collectAncestors(start: string,): string[] {
  const ancestors: string[] = [];
  let current = start;

  while (true) {
    const parent = dirname(current,);
    if (parent === current)
      break;

    ancestors.push(parent,);
    current = parent;
  }

  return ancestors;
}

/**
 * Finds the highest writable ancestor directory from the current working directory.
 *
 * Collects all ancestor paths, checks write permission in parallel,
 * then returns the highest (most distant) ancestor that succeeds.
 * Falls back to cwd if no parent is writable.
 *
 * @returns absolute path to the highest writable ancestor
 *
 * @example
 * ```ts
 * // If cwd is /home/user/projects/foo and /home/user is the highest writable:
 * await resolveRoot(); // '/home/user'
 * ```
 */
export async function resolveRoot(): Promise<string> {
  const cwd = resolve('.',);
  const ancestors = collectAncestors(cwd,);

  /** Check write permission for all ancestors concurrently. */
  const results = await Promise.allSettled(
    ancestors.map(async function checkWriteAccess(path,) {
      await access(path, constants.W_OK,);
      return path;
    },),
  );

  /** Find the highest writable ancestor (last fulfilled in the ordered list). */
  const root = results.reduce(function pickLastFulfilled(acc, result,) {
    return result.status === 'fulfilled' ? result.value : acc;
  }, cwd,);

  return root;
}
