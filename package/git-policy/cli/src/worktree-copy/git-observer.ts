import type { Dirent, } from 'node:fs';
import { readdir, } from 'node:fs/promises';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { resolveGitWorktreeIdentity, } from '../git-worktree-identity.ts';
import { WorktreeCopyError, } from './errors.ts';
import type { WorktreeCopyObservation, } from './model.ts';

/**
 * Logger root for linked-worktree registration observation.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 * Effective target cannot participate in worktree-copy lifecycle.
 */
export const WORKTREE_COPY_NOT_APPLICABLE: unique symbol = Symbol(
  'worktree copy has no applicable source repository',
);

/**
 * Reads linked-worktree administrative directory identities.
 *
 * @param adminRoot - common Git worktrees directory
 *
 * @returns directory basenames present at observation time
 *
 * @throws {@link WorktreeCopyError} when administration cannot be inspected
 *
 * @example
 * ```ts
 * await readAdminIds('/repo/.git/worktrees');
 * // => Set { 'topic' }
 * ```
 */
export async function readAdminIds(adminRoot: string,): Promise<ReadonlySet<string>> {
  try {
    /**
     * Directory entries beneath common worktree administration.
     */
    const entries = await readdir(
      adminRoot,
      { withFileTypes: true, },
    );
    return new Set(entries
      .filter(function isDirectory(entry: Readonly<Dirent>,): boolean {
        return entry.isDirectory();
      },)
      .map(function entryName(entry: Readonly<Dirent>,): string {
        return entry.name;
      },),);
  }
  catch (error: unknown) {
    if (Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT')) {
      return new Set();
    }
    throw new WorktreeCopyError(
      `cli-git: could not inspect linked-worktree administration at ${JSON.stringify(adminRoot,)}.`,
      error,
    );
  }
}

/**
 * Captures applicable linked-worktree repository and administrative identities.
 *
 * Shared identity resolution classifies effective target once for every package
 * consumer.
 * Main and outside targets return not-applicable before administrative reads.
 * Linked worktrees contribute canonical source root;
 * bare repositories retain empty-source behavior.
 *
 * @param args - forwarded Git arguments
 *
 * @param gitPath - absolute real-Git executable
 *
 * @returns repository observation or not-applicable sentinel
 *
 * @example
 * ```ts
 * await observeWorktreeRepository({ args: ['status'], gitPath: '/usr/bin/git' });
 * ```
 */
export async function observeWorktreeRepository({
  args,
  gitPath,
}: Readonly<{
  args: readonly string[];
  gitPath: string;
}>,): Promise<WorktreeCopyObservation | typeof WORKTREE_COPY_NOT_APPLICABLE> {
  /**
   * Tagged observer logger.
   */
  const rl = tagged({
    tag: observeWorktreeRepository.name,
    l,
  },);
  /**
   * Canonical repository identity shared across package consumers.
   */
  const identity = await resolveGitWorktreeIdentity({
    args,
    gitPath,
  },);
  if (identity.kind === 'outside-worktree') {
    rl.debug('effective invocation has no repository; worktree copy observation is not applicable',);
    return WORKTREE_COPY_NOT_APPLICABLE;
  }
  if (identity.kind === 'main-worktree') {
    rl.debug('effective invocation targets main worktree; worktree copy observation is not applicable',);
    return WORKTREE_COPY_NOT_APPLICABLE;
  }
  /**
   * Common linked-worktree administrative root.
   */
  const adminRoot = join(
    identity.commonDir,
    'worktrees',
  );
  /**
   * Existing linked-worktree identities.
   */
  const beforeAdminIds = await readAdminIds(adminRoot,);
  rl.debug(
    `captured ${String(beforeAdminIds.size,)} linked-worktree identities under ${identity.commonDir}`,
  );
  return {
    adminRoot,
    beforeAdminIds,
    commonDir: identity.commonDir,
    effectiveCwd: identity.effectiveCwd,
    ...(identity.kind === 'linked-worktree'
      ? { sourceRoot: identity.worktreeRoot, }
      : {}),
  };
}
