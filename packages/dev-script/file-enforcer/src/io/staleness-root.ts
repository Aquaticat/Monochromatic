import { stat, } from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import { caughtErrorHasCode, } from './error.ts';

/**
 * Directory name searched while locating the workspace dependency root.
 */
export const NODE_MODULES_DIRECTORY_NAME = 'node_modules';

/**
 * Returns whether a directory contains a `node_modules` directory.
 *
 * @param directory - Directory to inspect.
 *
 * @returns Whether `node_modules` exists as a directory under `directory`.
 *
 * @example
 * ```ts
 * const hasNodeModules = await hasNodeModulesDirectory(process.cwd());
 * ```
 */
async function hasNodeModulesDirectory(directory: string,): Promise<boolean> {
  try {
    /**
     * Candidate dependency directory.
     */
    const nodeModulesPath = join(
      directory,
      NODE_MODULES_DIRECTORY_NAME,
    );
    return (await stat(nodeModulesPath,))
      .isDirectory();
  }
  catch (statError: unknown) {
    if (caughtErrorHasCode({
      error: statError,
      code: 'ENOENT',
    },))
      return false;

    throw statError;
  }
}

/**
 * Walks ancestors until it finds a directory that owns `node_modules`.
 *
 * @param startDirectory - Directory where the upward walk starts.
 *
 * @returns First ancestor containing `node_modules`, or the resolved start directory when none exists.
 *
 * @example
 * ```ts
 * const root = await findNodeModulesRoot(process.cwd());
 * ```
 */
export async function findNodeModulesRoot(startDirectory: string,): Promise<string> {
  /**
   * Candidate directory that moves upward until dependency root or filesystem root.
   */
  let directory = resolve(startDirectory,);
  while (true) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- ancestor walk must inspect one directory before deciding the next parent.
    if (await hasNodeModulesDirectory(directory,))
      return directory;

    /**
     * Parent directory used to detect filesystem root.
     */
    const parentDirectory = dirname(directory,);
    if (parentDirectory === directory)
      return resolve(startDirectory,);
    directory = parentDirectory;
  }
}
