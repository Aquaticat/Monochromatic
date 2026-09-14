/**
 Repository-relative path form shared by the LFS helpers.

 @module
 */

import {
  relative,
  sep,
} from 'node:path';

/**
 Parameters for {@link repoRelative}.
 */
export type RepoRelativeParams = {
  /**
   Absolute repository root.
   */
  readonly repoRoot: string;
  /**
   Absolute path inside (or outside) the repository.
   */
  readonly path: string;
};

/**
 Repo-relative form of an absolute path with forward slashes, as git and
 the `ignore` matcher expect. A path outside the root comes back starting
 with `..`.

 @param repoRoot - absolute repository root

 @param path - absolute path inside (or outside) the repository

 @returns forward-slash path relative to the root

 @example
 ```ts
 repoRelative({ repoRoot: '/repo', path: '/repo/a/b.png' }); // 'a/b.png'
 ```
 */
export function repoRelative({
  repoRoot,
  path,
}: RepoRelativeParams,): string {
  return relative(
    repoRoot,
    path,
  )
    .split(sep,)
    .join('/',);
}
