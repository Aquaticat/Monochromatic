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
import { posix, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 * Module-scoped tagged logger.
 */
const l = tagged({ tag: 'path/ensure', },);

/* oxlint-disable eslint/require-await -- delegates to ensureFile/ensureDir which are async */
/**
 * Ensures a path exists as either a file or directory, based on whether
 * the path has a file extension, dispatching to {@link ensureFile} or
 * {@link ensureDir}.
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
  /**
   * Parsed segments used solely to read `ext`, which decides file-vs-directory dispatch.
   */
  const parsed = posix.parse(path,);

  if (parsed.ext) {
    l.info(`${path} has extension, ensuring as file`,);
    return ensureFile(path,);
  }

  return ensureDir(path,);
}
/* oxlint-enable eslint/require-await */

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
    /**
     * Metadata of the existing path; `ENOENT` short-circuits to the create branch via the outer `catch`.
     */
    const stats = await stat(path,);

    if (!stats.isDirectory())
      throw new Error(`Path ${path} exists but is not a directory.`,);

    l.info(`${path} already exists, checking accessibility`,);
  }
  catch (error: unknown) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- runtime stat result checked for isDirectory before cast
    if ((error as { code?: string; }).code
      === 'ENOENT') {
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
      constants.R_OK
        | constants
        .W_OK,
    );
    l.info(`${path} is accessible`,);
  }
  catch (error: unknown) {
    l.info(`${path} not accessible (${caughtValueText(error,)}), adjusting permissions`,);
    await chmod(
      path,
      constants.R_OK
        | constants
        .W_OK,
    );
  }

  return path;
}

/**
 * Ensures a file exists and is readable/writable.
 * Creates the file (and parent directories, via {@link ensureDir}) when missing.
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
  /**
   * Parsed segments captured up front so the create branch can pass `parsed.dir` to `ensureDir` without re-parsing.
   */
  const parsed = posix.parse(path,);

  try {
    /**
     * Metadata of the existing path; `ENOENT` short-circuits to the create branch via the outer `catch`.
     */
    const stats = await stat(path,);

    if (!stats.isFile())
      throw new Error(`Path ${path} exists but is not a file.`,);

    l.info(`${path} already exists, checking accessibility`,);
  }
  catch (error: unknown) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- runtime stat result checked for isFile before cast
    if ((error as { code?: string; }).code
      === 'ENOENT') {
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
      constants.R_OK
        | constants
        .W_OK,
    );
    l.info(`${path} is accessible`,);
  }
  catch (error: unknown) {
    l.info(`${path} not accessible (${caughtValueText(error,)}), adjusting permissions`,);
    await chmod(
      path,
      constants.R_OK
        | constants
        .W_OK,
    );
  }

  return path;
}
