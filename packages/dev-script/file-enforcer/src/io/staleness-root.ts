import { statSync, } from 'node:fs';
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
 * const hasNodeModules = hasNodeModulesDirectory(process.cwd());
 * ```
 */
function hasNodeModulesDirectory(directory: string,): boolean {
  try {
    /**
     * Candidate dependency directory.
     */
    const nodeModulesPath = join(
      directory,
      NODE_MODULES_DIRECTORY_NAME,
    );
    return statSync(nodeModulesPath,)
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
 * const root = findNodeModulesRoot(process.cwd());
 * ```
 */
export function findNodeModulesRoot(startDirectory: string,): string {
  for (let directory = resolve(startDirectory,); ; directory = dirname(directory,)) {
    if (hasNodeModulesDirectory(directory,))
      return directory;

    /**
     * Parent directory used to detect filesystem root.
     */
    const parentDirectory = dirname(directory,);
    if (parentDirectory === directory)
      return resolve(startDirectory,);
  }
}
