/**
 * Repository-bounded cli-git configuration discovery.
 *
 * @module
 */
import {
  lstat,
  realpath,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  findGitRepoRoot,
  GitRepositoryRootNotFoundError,
} from '@monochromatic-dev/module-fs-path/ts';
import { parseGlobalOptions, } from '../parse-global-options.ts';

/**
 * No repository configuration was discovered.
 */
export const CONFIG_ABSENT: unique symbol = Symbol('cli-git repository configuration is absent',);
/**
 * Supported discovered configuration format.
 */
export type ConfigFormat = 'mjs' | 'typescript';
/**
 * Canonical discovered configuration.
 */
export type DiscoveredConfig = Readonly<{
  /**
   * Canonical configuration path.
   */
  configPath: string;
  /**
   * Canonical repository root.
   */
  repositoryRoot: string;
  /**
   * Configuration source format.
   */
  format: ConfigFormat;
}>;

/**
 * Invalid repository configuration path.
 */
export class ConfigDiscoveryError extends Error {
  /**
   * Creates discovery failure.
   *
   * @param message - safe failure explanation
   */
  public constructor(message: string,) {
    super(message,);
    this.name = 'ConfigDiscoveryError';
  }
}

/**
 * Reports whether filesystem error means path absence.
 *
 * @param error - arbitrary filesystem failure
 *
 * @returns whether code is ENOENT
 */
function isMissingPath(error: unknown,): boolean {
  return Error.isError(error,)
    && ('code' in error)
    && (error.code === 'ENOENT');
}

/**
 * Finds one regular configuration path.
 *
 * @param path - candidate absolute path
 *
 * @returns canonical path or absence sentinel
 */
async function findRegularConfig(path: string,): Promise<string | typeof CONFIG_ABSENT> {
  try {
    /**
     * Candidate path metadata read without following final symlink.
     */
    const entry = await lstat(path,);
    if (entry.isSymbolicLink())
      throw new ConfigDiscoveryError(`Configuration path must not be a symbolic link: ${path}`,);
    if (!entry.isFile())
      throw new ConfigDiscoveryError(`Configuration path must be a regular file: ${path}`,);
    return await realpath(path,);
  }
  catch (error: unknown) {
    if (isMissingPath(error,))
      return CONFIG_ABSENT;
    throw error;
  }
}

/**
 * Resolves canonical repository root without requiring config artifact.
 *
 * @param args - exact wrapper arguments including Git global options
 *
 * @returns canonical root or absence outside repository
 *
 * @example
 * ```ts
 * await resolveConfigRepositoryRoot(['status']);
 * ```
 */
export async function resolveConfigRepositoryRoot(
  args: readonly string[],
): Promise<string | typeof CONFIG_ABSENT> {
  /**
   * Effective directory after ordered Git global chdir options.
   */
  const { effectiveCwd, } = parseGlobalOptions(args,);
  try {
    return await realpath(await findGitRepoRoot({ cwd: effectiveCwd, },),);
  }
  catch (error: unknown) {
    if ((error instanceof GitRepositoryRootNotFoundError) || isMissingPath(error,))
      return CONFIG_ABSENT;
    throw error;
  }
}

/**
 * Discovers repository-root configuration with MJS precedence.
 *
 * @param args - exact wrapper arguments including Git global options
 *
 * @returns canonical config or absence sentinel outside/configless repositories
 *
 * @example
 * ```ts
 * await discoverConfig(['status']);
 * ```
 */
export async function discoverConfig(args: readonly string[],): Promise<DiscoveredConfig | typeof CONFIG_ABSENT> {
  /**
   * Canonical valid Git repository root or absence sentinel.
   */
  const repositoryRoot = await resolveConfigRepositoryRoot(args,);
  if (repositoryRoot === CONFIG_ABSENT)
    return CONFIG_ABSENT;

  /**
   * Preferred root MJS path.
   */
  const mjsPath = await findRegularConfig(join(
    repositoryRoot,
    'cli-git.config.mjs',
  ),);
  if (mjsPath !== CONFIG_ABSENT) {
    return {
      configPath: mjsPath,
      repositoryRoot,
      format: 'mjs',
    };
  }
  /**
   * Fallback root TypeScript config path.
   */
  const typescriptPath = await findRegularConfig(join(
    repositoryRoot,
    'cli-git.config.ts',
  ),);
  if (typescriptPath === CONFIG_ABSENT)
    return CONFIG_ABSENT;
  return {
    configPath: typescriptPath,
    repositoryRoot,
    format: 'typescript',
  };
}
