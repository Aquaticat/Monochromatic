/**
 * Filesystem identity resolution for session state keying.
 *
 * Returns a stable identifier for the volume/filesystem containing
 * a given path. Used together with `rootDir` to key client-side
 * localStorage so that two different machines serving the same path
 * do not collide.
 *
 * - **Linux**: reads `f_fsid` via `stat -f --format=%i`, which is
 *   derived from the on-disk filesystem UUID and is stable across
 *   reboots.
 * - **Windows**: reads the volume serial number via `fsutil`.
 * - **macOS**: reads `f_fsid` via `stat -f -t '%v'`.
 */

import { execFileSync, } from 'node:child_process';
import { platform, } from 'node:os';

/**
 * Reads `f_fsid` on Linux via GNU coreutils `stat`.
 *
 * @param path - absolute path on the target filesystem
 *
 * @returns hex string filesystem identifier (e.g. `"a281dfd5d0534daf"`)
 */
function linuxFsId({ path, }: { readonly path: string; },): string {
  return execFileSync(
    'stat',
    [
      '-f',
      '--format=%i',
      path,
    ],
    { encoding: 'utf8', },
  )
    .trim();
}

/**
 * Length of a Windows drive root prefix (e.g. `"C:\"`).
 */
const DRIVE_ROOT_LENGTH = 3;

/**
 * Lowercase form of the `vol` command's serial-line label; matched case-insensitively.
 */
const SERIAL_LABEL = 'serial number is';

/**
 * Extracts the non-whitespace serial token that follows
 * `'Serial Number is'` (case-insensitively) in the `vol` output.
 *
 * @param output - raw `cmd /c vol` output
 *
 * @returns serial token, or empty string when not present
 *
 * @example
 * ```ts
 * parseVolumeSerial(' Volume Serial Number is 1A2B-3C4D\r\n'); // '1A2B-3C4D'
 * parseVolumeSerial('no serial line here'); // ''
 * ```
 */
export function parseVolumeSerial(output: string,): string {
  /**
   * Lower-cased copy used for the label scan; offsets line up with `output`.
   */
  const lower = output.toLowerCase();
  /**
   * Position of the label; -1 means the locale or shell output is unexpected.
   */
  const idx = lower.indexOf(SERIAL_LABEL,);
  if (idx === (-1))
    return '';
  /**
   * Cursor positioned at the first byte after the label.
   */
  const afterLabel = idx + SERIAL_LABEL
    .length;
  /**
   * Serial token scanned in one linear forward pass from `afterLabel`:
   * skip inline whitespace (`' '` / `'\t'` only), then accumulate the
   * non-whitespace token, stopping at any of the six ASCII whitespace
   * characters or the output end. IIFE-with-`let` keeps the forward-only
   * cursor in a tight scope (no recursion: O(n) time, O(1) stack on long
   * `vol` output; per-step `push` avoids the recursive accumulator's
   * repeated string rebuild).
   */
  return (function scanToken(): string {
    /**
     * Forward-only cursor; never rewinds, so the whole scan is one linear pass.
     */
    let cursor = afterLabel;
    while (cursor < output
      .length) {
      /**
       * Char at cursor; only ASCII space and tab precede the token.
       */
      const c = output.charAt(cursor,);
      if ((c !== ' ') && (c !== '\t'))
        break;
      cursor += 1;
    }
    /**
     * Token characters collected in order; joined once so the token is never rebuilt per step.
     */
    const collected: string[] = [];
    while (cursor < output
      .length) {
      /**
       * Char at cursor; any ASCII whitespace ends the token.
       */
      const c = output.charAt(cursor,);
      if (
        (c === ' ')
        || (c === '\t')
          || (c === '\n')
          || (c === '\r')
          || (c === '\f')
          || (c === '\v')
      ) {
        break;
      }
      collected.push(c,);
      cursor += 1;
    }
    return collected.join('',);
  })();
}

/**
 * Reads the volume serial number on Windows via the `vol` command.
 *
 * @param path - absolute path (e.g. `C:\Users\...`)
 *
 * @returns volume serial string
 */
function windowsFsId({ path, }: { readonly path: string; },): string {
  /**
   * Extract drive root (e.g. "C:\") from the absolute path.
   */
  const driveRoot = path.slice(
    0,
    DRIVE_ROOT_LENGTH,
  );
  /**
   * Raw output from `cmd /c vol`, expected to contain a "Serial Number is XXXX-XXXX" line.
   */
  const output = execFileSync(
    'cmd.exe',
    [
      '/c',
      'vol',
      driveRoot,
    ],
    {
      encoding: 'utf8',
    },
  );
  /**
   * Captured serial token; empty string means the locale or shell output is unexpected.
   */
  const serial = parseVolumeSerial(output,);
  if (serial === '')
    throw new Error(`failed to parse volume serial from: ${output}`,);
  return serial;
}

/**
 * Reads `f_fsid` on macOS via BSD `stat`.
 *
 * @param path - absolute path on the target filesystem
 *
 * @returns filesystem identifier string
 */
function darwinFsId({ path, }: { readonly path: string; },): string {
  return execFileSync(
    'stat',
    [
      '-f',
      '%v',
      path,
    ],
    { encoding: 'utf8', },
  )
    .trim();
}

/**
 * Resolves a stable filesystem/volume identifier for the filesystem
 * containing `path`. Cross-platform: works on Linux, Windows, and macOS.
 *
 * @param path - absolute path to resolve the filesystem for
 *
 * @returns filesystem identifier string, unique and stable per volume
 *
 * @throws when the platform is unsupported or the underlying command fails
 *
 * @example
 * ```ts
 * // Linux
 * resolveFsId({ path: '/home/user' });
 * // => "a281dfd5d0534daf"
 *
 * // Windows
 * resolveFsId({ path: 'C:\\Users\\user' });
 * // => "1A2B-3C4D"
 * ```
 */
export function resolveFsId({ path, }: { readonly path: string; },): string {
  /**
   * Host OS name from `os.platform()`; dispatched below to the per-OS implementation.
   */
  const os = platform();
  if (os === 'linux')
    return linuxFsId({ path, },);
  if (os === 'win32')
    return windowsFsId({ path, },);
  if (os === 'darwin')
    return darwinFsId({ path, },);
  throw new Error(`unsupported platform for filesystem ID resolution: ${os}`,);
}
