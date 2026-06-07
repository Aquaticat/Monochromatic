/**
 * Container-side TypeScript checker config generation.
 *
 * @example
 * ```ts
 * await writeMutationTsconfig({ packageCwd: '/work/packages/dev-script/file-enforcer' });
 * ```
 */

import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import spawn from 'nano-spawn';

/**
 * Generated mutation tsconfig file name inside target package work tree.
 */
export const MUTATION_TSCONFIG_NAME = 'tsconfig.mutation.json';

/**
 * TypeScript project file used as source for `--showConfig`.
 */
const SOURCE_TSCONFIG_NAME = 'tsconfig.json';

/**
 * TypeScript CLI binary available from baked root node_modules.
 */
const TYPESCRIPT_CLI = 'tsc';

/**
 * Arguments that ask TypeScript to print fully resolved config JSON.
 */
const SHOW_CONFIG_ARGS: readonly string[] = [
  '--showConfig',
  '--project',
  SOURCE_TSCONFIG_NAME,
];

/**
 * Reads TypeScript's resolved package config via `tsc --showConfig`.
 *
 * @param options - Target package working directory.
 *
 * @returns Resolved JSON config text from TypeScript.
 *
 * @example
 * ```ts
 * await readShownTsconfig({ packageCwd: '/work/packages/dev-script/file-enforcer' });
 * ```
 */
async function readShownTsconfig(options: {
  readonly packageCwd: string;
},): Promise<string> {
  /**
   * Captured TypeScript CLI result.
   */
  const result = await spawn(
    TYPESCRIPT_CLI,
    [...SHOW_CONFIG_ARGS,],
    {
      cwd: options.packageCwd,
    },
  );
  JSON.parse(result.stdout,) as unknown;
  return result.stdout;
}

/**
 * Writes resolved TypeScript checker config inside target package work tree.
 *
 * @param options - Target package working directory.
 *
 * @returns Package-relative generated tsconfig path.
 *
 * @example
 * ```ts
 * await writeMutationTsconfig({ packageCwd: '/work/packages/dev-script/file-enforcer' });
 * // 'tsconfig.mutation.json'
 * ```
 */
export async function writeMutationTsconfig(options: {
  readonly packageCwd: string;
},): Promise<string> {
  /**
   * Absolute generated config path in writable package work tree.
   */
  const configPath = join(
    options.packageCwd,
    MUTATION_TSCONFIG_NAME,
  );
  /**
   * Resolved TypeScript config printed by `--showConfig`.
   */
  const shownConfig = await readShownTsconfig({
    packageCwd: options.packageCwd,
  },);
  await writeFile(
    configPath,
    `${shownConfig}\n`,
    'utf8',
  );
  return MUTATION_TSCONFIG_NAME;
}
