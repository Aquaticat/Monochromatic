/**
 * Filesystem path-emptying utilities for Node.js / Bun.
 *
 * Each function clears the contents of a file or directory
 * without removing the path itself.
 */

import { readdir, readFile, rm, stat, writeFile, } from 'node:fs/promises';
import { join, parse, } from 'node:path/posix';
import { $ as tagged, } from '../types/t object/t logger/f/t object/t logger/tagged/r s/p n/index.ts';

/** Module-scoped tagged logger. */
const l = tagged({ tag: 'path/empty', },);

/**
 * Empties a path, choosing file or directory behavior based on
 * whether the path has a file extension.
 * Query parameters in paths (e.g. `?raw`) are stripped before inspection.
 *
 * @param path - Filesystem path to empty
 *
 * @returns Original path string (including any query suffix)
 *
 * @example
 * ```ts
 * await emptyPath('dist/output');       // removes all contents of directory
 * await emptyPath('dist/bundle.js');    // truncates file to empty
 * ```
 */
export async function emptyPath(path: string,): Promise<string> {
  const queryIndex = path.indexOf('?',);
  const cleanPath = queryIndex !== -1 ? path.slice(0, queryIndex,) : path;
  const parsed = parse(cleanPath,);

  if (parsed.ext) {
    l.info(`${path} has extension, emptying as file`,);
    return emptyFile(path,);
  }

  return emptyDir(cleanPath,);
}

/**
 * Removes all entries inside a directory without removing the directory itself.
 *
 * @param path - Directory path to empty
 *
 * @returns Resolved path string
 *
 * @example
 * ```ts
 * await emptyDir('dist');
 * ```
 */
export async function emptyDir(path: string,): Promise<string> {
  const entries = await readdir(path,);

  await Promise.all(entries.map(function removeEntry(entry,): Promise<void> {
    return rm(join(path, entry,), { recursive: true, force: true, },);
  },),);

  return path;
}

/**
 * Truncates a file to zero bytes.
 * Query parameters in paths (e.g. `?raw`) are stripped.
 *
 * @param path - File path to empty
 *
 * @returns Original path string (including any query suffix)
 *
 * @example
 * ```ts
 * await emptyFile('dist/bundle.js');
 * ```
 */
export async function emptyFile(path: string,): Promise<string> {
  const queryIndex = path.indexOf('?',);
  const cleanPath = queryIndex !== -1 ? path.slice(0, queryIndex,) : path;

  await writeFile(cleanPath, '',);
  return path;
}

/**
 * Removes all empty files (zero bytes after trimming) from a directory.
 * Non-file entries and files with content are left untouched.
 *
 * @param path - Directory path to scan
 *
 * @returns Resolved path string
 *
 * @example
 * ```ts
 * await removeEmptyFilesInDir('src/generated');
 * ```
 */
export async function removeEmptyFilesInDir(path: string,): Promise<string> {
  const entries = await readdir(path,);

  await Promise.all(
    entries.map(async function checkAndRemoveIfEmpty(entry,): Promise<void> {
      const fullPath = join(path, entry,);
      const stats = await stat(fullPath,);

      if (stats.isFile()) {
        const content = await readFile(fullPath, 'utf8',);
        if (content.trim() === '') {
          l.debug(`Removing empty file ${fullPath}`,);
          await rm(fullPath, { force: true, },);
        }
      }
    },),
  );

  return path;
}
