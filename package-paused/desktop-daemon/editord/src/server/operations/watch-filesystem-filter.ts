/**
 * Filtering constants and helpers for the directory watcher.
 *
 * Centralizes ignore logic so the watcher module stays under the line limit.
 */

/**
 * Entry names always ignored (VCS dirs, OS metadata).
 */
const IGNORED_NAMES = new Set([
  '.git',
  'node_modules',
  '.DS_Store',
  'Thumbs.db',
],);

/**
 * Vim's atomic-save sentinel filename; ignored verbatim.
 */
const VIM_SENTINEL = '4913';

/**
 * Minimum length for the legacy emacs `#name#` lock-file shape.
 */
const EMACS_LOCK_MIN_LENGTH = 2;

/**
 * Returns whether `name` looks like an editor swap or temp file.
 * Matches the same set the original regex did:
 * - ends with `.swp` (vim swap)
 * - ends with `~` (gedit/vim backup)
 * - starts with `.#` (emacs file lock)
 * - starts and ends with `#` with at least two characters (legacy emacs lock)
 * - equals `4913` (vim's atomic-save sentinel)
 *
 * @param name - entry name
 *
 * @returns true when the name is a known editor swap/temp shape
 */
function isEditorSwapName(name: string,): boolean {
  if (name === VIM_SENTINEL)
    return true;
  if (name.endsWith('.swp',))
    return true;
  if (name.endsWith('~',))
    return true;
  if (name.startsWith('.#',))
    return true;
  if (
    (name.length
      >= EMACS_LOCK_MIN_LENGTH)
    && name
      .startsWith('#',)
      && name
      .endsWith('#',)
  ) {
    return true;
  }
  return false;
}

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
export function isIgnored({ name, }: { readonly name: string; },): boolean {
  return IGNORED_NAMES.has(name,)
    || isEditorSwapName(name,);
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
 * Substring marking the boundary between basename and hex token in editord temps.
 */
const EDITORD_TAG = '.editord.';

/**
 * Returns whether `c` is an ASCII lowercase hex digit (`0`-`9` or `a`-`f`).
 *
 * @param c - candidate character
 *
 * @returns true when the character is a lowercase hex digit
 */
function isLowerHexChar(c: string,): boolean {
  return ((c >= '0') && (c <= '9')) || ((c >= 'a') && (c <= 'f'));
}

/**
 * Returns whether `name` matches the temp-filename shape produced by
 * `writeFileAtomic`: starts with `.`, contains `.editord.`, then a
 * non-empty run of lowercase hex digits followed by a trailing `~`.
 *
 * @param name - entry name to test
 *
 * @returns true when the name looks like an editord atomic-write temp
 *
 * @example
 * ```ts
 * const result = isEditordTempFile('.foo.ts.editord.a1b2c3d4e5f6~');
 * ```
 */
export function isEditordTempFile(name: string,): boolean {
  if (!name.startsWith('.',))
    return false;
  if (!name.endsWith('~',))
    return false;
  /**
   * Right-most occurrence of the tag; chosen so embedded `.editord.` substrings do not throw off the hex span.
   */
  const tagIdx = name.lastIndexOf(EDITORD_TAG,);
  if (tagIdx === (-1))
    return false;
  /**
   * First index of the hex span; immediately after the trailing `.` of the tag.
   */
  const hexStart = tagIdx + EDITORD_TAG
    .length;
  /**
   * Exclusive end of the hex span; immediately before the trailing `~`.
   */
  const hexEnd = name.length
    - 1;
  if (hexEnd <= hexStart)
    return false;
  /**
   * Recursive verifier that confirms every character in `[idx, hexEnd)` is a
   * lowercase hex digit.
   *
   * @param idx - cursor into `name`
   *
   * @returns true when the entire span is hex
   */
  function checkHexRun(idx: number,): boolean {
    if (idx >= hexEnd)
      return true;
    if (!isLowerHexChar(name.charAt(idx,),))
      return false;
    return checkHexRun(idx + 1,);
  }
  return checkHexRun(hexStart,);
}
