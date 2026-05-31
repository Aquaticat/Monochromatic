/**
 * Per-repo git directory layout.
 *
 * The forge stores each repository as a bare on-disk gitdir under
 * `${WEBAPP_FORGE_GITDIR_ROOT}/${owner}/${repo}.git/`. The root defaults to
 * `${cwd}/.gitdir` when the env var is unset. Disk is the source of truth
 * for git data; this is option (a) from
 * `server/TROUBLESHOOTING.isomorphic-git.md`.
 *
 * Phase 3+ may swap this for a libSQL-backed virtual filesystem when
 * multi-machine deployment becomes a goal; the public surface here
 * (a directory path string) doesn't change.
 */

import { join, } from 'node:path';

/**
 * Returns the directory under which all bare repos live.
 *
 * @returns the absolute root path
 *
 * @example
 * ```ts
 * gitdirRoot(); // '/home/forge/.gitdir' or whatever WEBAPP_FORGE_GITDIR_ROOT is set to
 * ```
 */
export function gitdirRoot(): string {
  /**
   * Optional environment override; falls back to `<cwd>/.gitdir` below.
   */
  const fromEnv = process.env
    .WEBAPP_FORGE_GITDIR_ROOT;
  if ((fromEnv !== undefined) && (fromEnv !== ''))
    return fromEnv;
  return join(
    process.cwd(),
    '.gitdir',
  );
}

/**
 * Returns the bare gitdir path for a single repository.
 *
 * @param row - inputs
 *
 * @returns absolute path of the bare gitdir
 *
 * @example
 * ```ts
 * repoGitdir({ owner: 'alice', repo: 'demo' });
 * // '/home/forge/.gitdir/alice/demo.git'
 * ```
 */
export function repoGitdir(row: {
  readonly owner: string;
  readonly repo: string;
},): string {
  return join(
    gitdirRoot(),
    row.owner,
    `${row.repo}.git`,
  );
}
