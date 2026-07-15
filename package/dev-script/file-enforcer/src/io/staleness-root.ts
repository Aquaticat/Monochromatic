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
 * Walks ancestors via {@link findNodeModulesRootFromDirectory} until it finds
 * a directory that owns `node_modules`.
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
  return await findNodeModulesRootFromDirectory({
    directory: resolve(startDirectory,),
    startDirectory,
  },);
}

/**
 * Walks parent directories, checking each with {@link hasNodeModulesDirectory},
 * until a dependency root or filesystem root is reached.
 *
 * @param directory - Directory currently being inspected.
 *
 * @param startDirectory - Original directory used as fallback.
 *
 * @returns First ancestor containing `node_modules`, or resolved original directory when none exists.
 *
 * @example
 * ```ts
 * const root = await findNodeModulesRootFromDirectory({ directory: process.cwd(), startDirectory: process.cwd() });
 * ```
 */
async function findNodeModulesRootFromDirectory(
  {
    directory,
    startDirectory,
  }: {
    readonly directory: string;
    readonly startDirectory: string;
  },
): Promise<string> {
  if (await hasNodeModulesDirectory(directory,))
    return directory;

  /**
   * Parent directory used to detect filesystem root.
   */
  const parentDirectory = dirname(directory,);
  if (parentDirectory === directory)
    return resolve(startDirectory,);
  return await findNodeModulesRootFromDirectory({
    directory: parentDirectory,
    startDirectory,
  },);
}
