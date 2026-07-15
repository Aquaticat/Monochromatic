/**
 * Atomic file-write helper for editord.
 *
 * Writes the new content to a sibling temp file in the same directory, fsyncs
 * the file descriptor, then renames the temp over the target.
 * Single-filesystem `rename(2)` is atomic, so concurrent readers see either
 * the old content or the new content but never a partial or empty file.
 *
 * Refuses to write through symlinks via `O_NOFOLLOW`; preserves the target's
 * existing permission bits via `fchmod`.
 *
 * Design rationale (same-dir temp, hidden + `~`-suffixed name, no fallback to
 * a non-atomic write) is documented in
 * `/home/user/.claude/plans/1-migrate-editord-to-wiggly-tome.md` and the
 * root-level `doc/troubleshooting/claude-code-edit-non-atomic-fallback.md`.
 */

import { randomBytes, } from 'node:crypto';
import { constants as fsConstants, } from 'node:fs';
import {
  lstat,
  open,
  rename,
  unlink,
} from 'node:fs/promises';
import {
  basename,
  dirname,
  join,
} from 'node:path';

/**
 * Open flags for the temp file:
 * - `O_WRONLY`: we only write.
 * - `O_CREAT`: create the temp file.
 * - `O_EXCL`: fail if the temp file already exists (random suffix prevents
 *   collisions in practice; `O_EXCL` is defence-in-depth).
 * - `O_NOFOLLOW`: refuse the open if a pre-existing entity at the temp
 *   path turns out to be a symlink. Combined with `O_EXCL`, the only
 *   acceptable state for the temp path is "does not exist."
 *
 * Symlink protection for the **target** path is enforced separately by the
 * `lstat` check in {@link refuseIfSymlink}; without it, `rename(temp, target)`
 * would silently replace a symlinked target with a regular file. See
 * `doc/troubleshooting/claude-code-edit-non-atomic-fallback.md` for the
 * Claude Code `PRH` pattern this mirrors.
 */
const TEMP_OPEN_FLAGS = fsConstants.O_WRONLY
  | fsConstants
  .O_CREAT
  | fsConstants
  .O_EXCL
  | fsConstants
  .O_NOFOLLOW;

/**
 * Number of random bytes in the temp-file suffix. 6 bytes is 12 hex chars,
 * giving 2^48 ≈ 2.8e14 distinct suffixes; collision is astronomically
 * unlikely even under concurrent saves of the same target.
 * Matches Claude Code's `PRH` width.
 */
const TEMP_SUFFIX_BYTES = 6;

/**
 * Builds the temp path for a target.
 * Format (where DIR is the parent directory and BASE the target's basename):
 * `DIR/.BASE.editord.HEX~`.
 *
 * - Dot-prefix hides the temp from `ls`, file trees, and most git tooling.
 * - `editord` identifies the temp as ours, for crash-recovery sweeps.
 * - 12-hex-char random suffix avoids collisions across concurrent saves.
 * - Trailing `~` is already matched by editord's `IGNORED_PATTERN`, so the
 *   temp file's add/unlink events never reach the watcher's event consumer.
 *
 * @param path - absolute path of the final target
 *
 * @returns absolute path of the temp file
 *
 * @example
 * ```ts
 * const tempPath = buildTempPath('/home/u/proj/src/index.ts');
 * // Produces something like '/home/u/proj/src/.index.ts.editord.a1b2c3d4e5f6~'
 * ```
 */
function buildTempPath(path: string,): string {
  /**
   * Random suffix prevents collisions when multiple writers target the same file.
   */
  const rand = randomBytes(TEMP_SUFFIX_BYTES,)
    .toString('hex',);
  return join(
    dirname(path,),
    `.${basename(path,)}.editord.${rand}~`,
  );
}

/**
 * Refuses to write to a symlinked target, and reads the target's mode bits
 * for preservation in the same `lstat` call. Both questions need an `lstat`
 * (not `stat`) because `stat` follows symlinks and would silently expose
 * the linked-to file's mode and existence.
 *
 * Returns `null` when the target does not yet exist (new-file path), in
 * which case the temp inherits the daemon's default `umask` and `fchmod`
 * is skipped. Throws `ELOOP` when the target is a symlink, matching the
 * user-facing semantics of "Refuse" in the plan's symlink decision. Errors
 * other than `ENOENT` propagate as real I/O problems.
 *
 * @param path - absolute path of the final target
 *
 * @returns the target's `stats.mode`, or `null` if the target does not exist
 *
 * @throws `ELOOP` when `path` is a symlink; other errors when `lstat` fails
 *   for a reason other than `ENOENT`
 */
async function refuseSymlinkAndReadMode(path: string,): Promise<number | null> {
  try {
    /**
     * `lstat` (not `stat`) so the symlink check sees the link itself, not its target.
     */
    const stats = await lstat(path,);
    if (stats.isSymbolicLink()) {
      /**
       * ELOOP-tagged so the caller can branch on `.code` like a real `fs` error.
       */
      const symlinkErr: Error & { code?: string; } = new Error(
        `refusing to write through symlink: ${path}`,
      );
      symlinkErr.code = 'ELOOP';
      throw symlinkErr;
    }
    return stats.mode;
  }
  catch (statErr) {
    if ((statErr instanceof Error) && ('code' in statErr)
      && (statErr.code
        === 'ENOENT'))
      return null;
    throw statErr;
  }
}

/**
 * Writes content to the temp file, preserves the target's mode (if it
 * existed), and fsyncs the descriptor.
 * `await using` ensures the descriptor is closed when this function returns,
 * before the caller renames the temp into place.
 *
 * @param tempPath - absolute path of the temp file
 *
 * @param content - utf8 content to write
 *
 * @param originalMode - target's previous `stats.mode`, or `null` for a new file
 *
 * @throws when open, write, chmod, or sync fails
 */
async function writeContentToTemp(
  {
    tempPath,
    content,
    originalMode,
  }: {
    readonly tempPath: string;
    readonly content: string;
    readonly originalMode: number | null;
  },
): Promise<void> {
  /**
   * `await using` ensures close runs before the caller renames the temp into place.
   */
  await using fd = await open(
    tempPath,
    TEMP_OPEN_FLAGS,
  );
  await fd.writeFile(
    content,
    { encoding: 'utf8', },
  );
  if (originalMode !== null)
    await fd.chmod(originalMode,);
  await fd.sync();
}

/**
 * Removes a leftover temp file. Errors are swallowed: the per-directory
 * orphan sweep in `DirWatcher` cleans up anything we miss, and the caller
 * cares about the original failure, not the cleanup.
 *
 * @param tempPath - absolute path of the temp file to remove
 */
async function cleanupTemp(tempPath: string,): Promise<void> {
  try {
    await unlink(tempPath,);
  }
  catch {
    /* Best-effort. Orphan sweep on next watchDir picks up survivors. */
  }
}

/**
 * Writes `content` to `path` atomically.
 * After this resolves, concurrent readers see either the prior content of
 * `path` (if any) or `content`, never a partial or empty intermediate state.
 *
 * Refuses to write through a symlink at the final path component.
 * Preserves the existing permission bits if `path` already exists.
 *
 * Does **not** fall back to a non-atomic write on failure: surface the error
 * to the caller instead. The fallback path is the bug documented in
 * `doc/troubleshooting/claude-code-edit-non-atomic-fallback.md`; editord has no
 * scenario where a torn write is preferable to a propagated error.
 *
 * @param path - absolute path of the target file
 *
 * @param content - utf8 content to write
 *
 * @throws when stat (non-ENOENT), open, write, chmod, sync, or rename fails;
 *   when `path` is a symlink (ELOOP from `O_NOFOLLOW`); when the parent
 *   directory is missing or read-only
 *
 * @example
 * ```ts
 * await writeFileAtomic({
 *   path: '/home/u/proj/src/index.ts',
 *   content: 'export const value = 42;\n',
 * });
 * ```
 */
export async function writeFileAtomic(
  {
    path,
    content,
  }: {
    readonly path: string;
    readonly content: string;
  },
): Promise<void> {
  /**
   * Captured up-front so the temp can inherit the target's mode if it existed.
   */
  const originalMode = await refuseSymlinkAndReadMode(path,);
  /**
   * Sibling temp path used for the atomic write-then-rename swap.
   */
  const tempPath = buildTempPath(path,);
  try {
    await writeContentToTemp({
      tempPath,
      content,
      originalMode,
    },);
    await rename(
      tempPath,
      path,
    );
  }
  catch (writeErr) {
    await cleanupTemp(tempPath,);
    throw writeErr;
  }
}
