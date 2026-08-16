import {
  lstat,
  realpath,
} from 'node:fs/promises';

import { WorktreeCopyError, } from './errors.ts';

/**
 * Group and other permission bits forbidden on private worktree-copy paths.
 */
const NON_PRIVATE_MODE_BITS = 0o077;

/**
 * Security role determining expected filesystem entry kind and diagnostic subject.
 *
 * @example
 * ```ts
 * const role: PrivateWorktreeCopyPathRole = 'private stage';
 * ```
 */
type PrivateWorktreeCopyPathRole =
  | 'journal directory'
  | 'journal file'
  | 'private stage';

/**
 * Asserts worktree-copy path is canonical, private, owned, and expected entry kind.
 * Journal files must additionally have exactly one hard link.
 *
 * @param path - used as canonical absolute identity so aliases are rejected
 *
 * @param role - selects role-specific entry checks and stable failure wording
 *
 * @throws {@link WorktreeCopyError} when path identity or metadata is unsafe
 *
 * @example
 * ```ts
 * await assertPrivateWorktreeCopyPath({
 *   path: '/repo/.git/cli-git-worktree-copy/v1',
 *   role: 'journal directory',
 * });
 * ```
 */
export async function assertPrivateWorktreeCopyPath({
  path,
  role,
}: Readonly<{
  path: string;
  role: PrivateWorktreeCopyPathRole;
}>,): Promise<void> {
  /**
   * No-follow metadata for exact path supplied by caller.
   */
  const stats = await lstat(path,);
  /**
   * Whether metadata matches role-specific entry and link requirements.
   */
  const hasExpectedEntryShape = role === 'journal file'
    ? stats.isFile() && (stats.nlink === 1)
    : stats.isDirectory();
  /**
   * Effective account owner when platform exposes POSIX identity.
   */
  const effectiveUserId = process.geteuid?.();
  if ((!hasExpectedEntryShape)
    || ((stats.mode & NON_PRIVATE_MODE_BITS) !== 0)
    || ((effectiveUserId !== undefined) && (stats.uid !== effectiveUserId))
    || ((await realpath(path,)) !== path)) {
    throw new WorktreeCopyError(
      `cli-git: worktree-copy ${role} is unsafe: ${JSON.stringify(path,)}.`,
    );
  }
}
