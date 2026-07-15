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
  /**
   * Accumulator for each ancestor seen on the walk; returned to the caller.
   */
  const ancestors: string[] = [];
  /**
   * Cursor used by the walk loop; advances one directory level per iteration.
   */
  let current = start;

  while (true) {
    /**
     * Parent directory of the cursor; equal to `current` only at the filesystem root.
     */
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
 * On standard Linux systems, this is typically `/home/user`, so the file
 * tree spans the entire home directory. In containers or VMs where `/`
 * is writable, the tree spans the whole filesystem.
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
  /**
   * Absolute current working directory; used as the walk seed and the fallback root.
   */
  const cwd = resolve('.',);
  /**
   * Every ancestor directory of `cwd`, near-to-far; candidate set for the highest writable.
   */
  const ancestors = collectAncestors(cwd,);

  /**
   * Check write permission for all ancestors concurrently.
   */
  const results = await Promise.allSettled(
    ancestors.map(async function checkWriteAccess(path,) {
      await access(
        path,
        constants.W_OK,
      );
      return path;
    },),
  );

  /**
   * Find the highest writable ancestor (last fulfilled in the ordered list).
   */
  const root = results.reduce(
    function pickLastFulfilled(
      acc,
      result,
    ) {
      return result.status
        === 'fulfilled' ? result.value : acc;
    },
    cwd,
  );

  return root;
}
