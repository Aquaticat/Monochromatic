/**
 * Filtering constants and helpers for the directory watcher.
 *
 * Centralizes ignore logic so the watcher module stays under the line limit.
 */

/** Entry names always ignored (VCS dirs, OS metadata). */
const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  'Thumbs.db',
],);

/** Pattern matching editor swap/temp files. */
const IGNORED_PATTERN = /\.swp$|~$|^\.#|^#.*#$|^4913$/;

/**
 * Returns whether a filename should be silently ignored by the watcher.
 *
 * @param name - entry name (not full path)
 *
 * @returns true when the name matches a known noise source
 *
 * @example
 * ```ts
 * const result = isIgnored({ name: 'utils.ts', });
 * ```
 */
export function isIgnored({ name, }: { name: string; },): boolean {
  return IGNORED_NAMES.has(name,) || IGNORED_PATTERN.test(name,);
}

/**
 * Stability window for chokidar `awaitWriteFinish`.
 * Chunked external editor writes (large pastes, multi-syscall saves) must hold
 * size steady for this long before chokidar emits the change.
 * Higher than chokidar's recommended floor (50) to be safe against slower
 * external editors; lower than chokidar's default (2000) so interactive saves
 * surface promptly.
 */
export const AWAIT_WRITE_FINISH_MS = 150;

/**
 * Poll interval used during the {@link AWAIT_WRITE_FINISH_MS} stability window.
 */
export const AWAIT_WRITE_FINISH_POLL_MS = 25;

/**
 * Suppression window in milliseconds.
 * After a self-triggered save, events for that path are ignored for this duration.
 */
export const SUPPRESS_MS = 500;

/**
 * Pattern matching the temp filenames produced by {@link writeFileAtomic}.
 * Used to sweep orphaned editord temps from a directory before watching it.
 *
 * @example
 * ```ts
 * const result = EDITORD_TEMP_PATTERN.test('.foo.ts.editord.a1b2c3d4e5f6~');
 * ```
 */
export const EDITORD_TEMP_PATTERN = /^\..*\.editord\.[0-9a-f]+~$/;
