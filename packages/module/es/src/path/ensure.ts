/**
 * Filesystem path-existence guarantees for Node.js / Bun.
 *
 * Each function creates the target path (file or directory) when it does
 * not exist and verifies read/write accessibility when it does.
 */

import {
  access,
  chmod,
  constants,
  mkdir,
  stat,
  writeFile,
} from 'node:fs/promises';
import { parse, } from 'node:path/posix';
import {
  $ as tagged,
} from '../types/t object/t logger/f/t object/t logger/tagged/r s/p n/index.ts';

/** Module-scoped tagged logger. */
const l = tagged({ tag: 'path/ensure', },);

/**
 * Ensures a path exists as either a file or directory, based on whether
 * the path has a file extension.
 *
 * @param path - Filesystem path to ensure
 *
 * @returns Resolved path string
 *
 * @throws When the path exists but is the wrong kind (file vs directory)
 *
 * @example
 * ```ts
 * await ensurePath('logs/app.log');   // creates file + parent dirs
 * await ensurePath('logs/archive/');  // creates directory tree
 * ```
 */
export async function ensurePath(path: string,): Promise<string> {
  const parsed = parse(path,);

  if (parsed.ext) {
    l.info(`${path} has extension, ensuring as file`,);
    return ensureFile(path,);
  }

  return ensureDir(path,);
}

/**
 * Ensures a directory exists and is readable/writable.
 * Creates it recursively when missing.
 *
 * @param path - Directory path to ensure
 *
 * @returns Resolved path string
 *
 * @throws When the path exists but is not a directory
 *
 * @example
 * ```ts
 * await ensureDir('logs/archive');
 * ```
 */
export async function ensureDir(path: string,): Promise<string> {
  try {
    const stats = await stat(path,);

    if (!stats.isDirectory())
      throw new Error(`Path ${path} exists but is not a directory.`,);

    l.info(`${path} already exists, checking accessibility`,);
  }
  catch (error: unknown) {
    if ((error as { code?: string; }).code === 'ENOENT') {
      l.info(`${path} does not exist, creating recursively`,);
      await mkdir(
        path,
        { recursive: true, },
      );
      return path;
    }
    throw error;
  }

  try {
    await access(
      path,
      constants.R_OK | constants.W_OK,
    );
    l.info(`${path} is accessible`,);
  }
  catch {
    l.info(`${path} not accessible, adjusting permissions`,);
    await chmod(
      path,
      constants.R_OK | constants.W_OK,
    );
  }

  return path;
}

/**
 * Ensures a file exists and is readable/writable.
 * Creates the file (and parent directories) when missing.
 *
 * @param path - File path to ensure
 *
 * @returns Resolved path string
 *
 * @throws When the path exists but is not a regular file
 *
 * @example
 * ```ts
 * await ensureFile('config/app.json');
 * ```
 */
export async function ensureFile(path: string,): Promise<string> {
  const parsed = parse(path,);

  try {
    const stats = await stat(path,);

    if (!stats.isFile())
      throw new Error(`Path ${path} exists but is not a file.`,);

    l.info(`${path} already exists, checking accessibility`,);
  }
  catch (error: unknown) {
    if ((error as { code?: string; }).code === 'ENOENT') {
      l.info(`${path} does not exist, creating`,);
      await ensureDir(parsed.dir,);
      await writeFile(
        path,
        '',
        { flag: 'w', },
      );
      return path;
    }
    throw error;
  }

  try {
    await access(
      path,
      constants.R_OK | constants.W_OK,
    );
    l.info(`${path} is accessible`,);
  }
  catch {
    l.info(`${path} not accessible, adjusting permissions`,);
    await chmod(
      path,
      constants.R_OK | constants.W_OK,
    );
  }

  return path;
}
