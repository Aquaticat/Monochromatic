import type { Dirent, } from 'node:fs';
import {
  readdir,
  stat,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { spawnResult, } from './spawn.ts';

/**
 * Reads a directory's entries, treating a missing directory as empty.
 *
 * @param dir - directory to read
 *
 * @returns directory entries, or an empty list when the directory is absent
 *
 * @example
 * ```ts
 * const entries = await readEntries({ dir: '/tmp/clone/objects' });
 * ```
 */
async function readEntries({ dir, }: { readonly dir: string; },): Promise<readonly Dirent[]> {
  try {
    return await readdir(
      dir,
      { withFileTypes: true, },
    );
  }
  catch {
    return [];
  }
}

/**
 * Recursively sums the byte size of every regular file under a directory,
 * using an explicit work-stack rather than recursion. Returns 0 when the
 * directory does not exist (a freshly cloned repo may have an empty store).
 *
 * @param path - directory to measure
 *
 * @returns total bytes of all regular files beneath `path`
 *
 * @example
 * ```ts
 * const bytes = await dirSize({ path: '/tmp/clone/objects' });
 * ```
 */
export async function dirSize({ path, }: { readonly path: string; },): Promise<number> {
  /**
   * Mutable accumulator; a const binding with a mutated field keeps the
   * function-root-let lint satisfied.
   */
  const acc = { bytes: 0, };
  /**
   * Pending directories to visit; a side-effecting cursor walked via `pop`.
   */
  const stack: string[] = [path,];
  /* oxlint-disable eslint/no-await-in-loop -- a directory tree is walked with an explicit work-stack; each `readdir`/`stat` depends on a directory popped from the stack, so the level-by-level descent is inherently sequential. A git object store under a temp clone holds only a handful of pack files, so the serial walk is cheap. */
  while (stack.length > 0) {
    /**
     * Next directory to read; non-nullish given the length guard above.
     */
    const dir = nonNullishOrThrow(stack.pop(),);
    /**
     * Directory entries, or an empty list when the directory is absent.
     */
    const entries = await readEntries({ dir, },);
    for (const entry of entries) {
      /**
       * Absolute path of this entry.
       */
      const full = join(
        dir,
        entry.name,
      );
      if (entry.isDirectory()) {
        stack.push(full,);
        continue;
      }
      if (entry.isFile()) {
        /**
         * File metadata for the byte size.
         */
        const info = await stat(full,);
        acc.bytes += info.size;
      }
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */
  return acc.bytes;
}

/**
 * Resolves a repository's object-store directory via git, then measures it.
 * Targets `objects/` specifically, not the whole git dir, so the near-constant
 * hooks/config/description offset does not distort small-repo ratios.
 *
 * @param repoPath - repository working directory or git dir
 *
 * @returns total bytes of the object store, or 0 when unresolved
 *
 * @example
 * ```ts
 * const bytes = await objectsDirSize({ repoPath: '/tmp/clone' });
 * ```
 */
export async function objectsDirSize({ repoPath, }: { readonly repoPath: string; },): Promise<number> {
  /**
   * Absolute objects path as git resolves it, honoring bare vs non-bare and
   * any `GIT_OBJECT_DIRECTORY` override.
   */
  const {
    stdout,
    exitCode,
  } = await spawnResult({
    command: 'git',
    args: [
      '-C',
      repoPath,
      'rev-parse',
      '--git-path',
      'objects',
    ],
  },);
  if ((exitCode !== 0) || (stdout === ''))
    return 0;
  /**
   * `--git-path` yields a path relative to the repo unless absolute; join
   * against the repo so a relative `objects` resolves correctly.
   */
  const objectsPath = stdout.startsWith('/',) ? stdout : join(
    repoPath,
    stdout,
  );
  return await dirSize({ path: objectsPath, },);
}
