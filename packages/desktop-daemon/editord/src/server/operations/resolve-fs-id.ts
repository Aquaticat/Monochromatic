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
function linuxFsId({ path, }: { path: string; },): string {
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

/** Length of a Windows drive root prefix (e.g. `"C:\"`). */
const DRIVE_ROOT_LENGTH = 3;

/**
 * Reads the volume serial number on Windows via the `vol` command.
 *
 * @param path - absolute path (e.g. `C:\Users\...`)
 *
 * @returns volume serial string
 */
function windowsFsId({ path, }: { path: string; },): string {
  /** Extract drive root (e.g. "C:\") from the absolute path. */
  const driveRoot = path.slice(
    0,
    DRIVE_ROOT_LENGTH,
  );
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
  const match = output.match(/Serial Number is\s+(\S+)/i,);
  if (match === null)
    throw new Error(`failed to parse volume serial from: ${output}`,);
  return match[1] ?? '';
}

/**
 * Reads `f_fsid` on macOS via BSD `stat`.
 *
 * @param path - absolute path on the target filesystem
 *
 * @returns filesystem identifier string
 */
function darwinFsId({ path, }: { path: string; },): string {
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
export function resolveFsId({ path, }: { path: string; },): string {
  const os = platform();
  if (os === 'linux')
    return linuxFsId({ path, },);
  if (os === 'win32')
    return windowsFsId({ path, },);
  if (os === 'darwin')
    return darwinFsId({ path, },);
  throw new Error(`unsupported platform for filesystem ID resolution: ${os}`,);
}
