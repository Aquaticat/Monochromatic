/**
 * Container-side TypeScript checker config generation.
 *
 * @example
 * ```ts
 * await writeMutationTsconfig({
 *   packageCwd: '/work/packages/dev-script/file-enforcer',
 *   mutateFile: 'src/io/glob.ts',
 * });
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
 * Parsed JSON object from TypeScript showConfig output.
 */
type ShownTsconfig = Readonly<Record<string, unknown>>;

/**
 * Returns whether an unknown JSON value is a non-array object.
 *
 * @param value - Parsed JSON value.
 *
 * @returns True when value can be treated as config object.
 *
 * @example
 * ```ts
 * isShownTsconfig({ compilerOptions: {} });
 * // true
 * ```
 */
function isShownTsconfig(value: unknown,): value is ShownTsconfig {
  return (((typeof value) === 'object')
    && (value !== null)
    && (!Array.isArray(value,)));
}

/**
 * Parses TypeScript showConfig output.
 *
 * @param stdout - TypeScript CLI stdout.
 *
 * @returns Parsed showConfig object.
 *
 * @throws When TypeScript prints non-object JSON.
 *
 * @example
 * ```ts
 * parseShownTsconfig('{"compilerOptions":{}}');
 * ```
 */
function parseShownTsconfig(stdout: string,): ShownTsconfig {
  /**
   * Parsed JSON value from TypeScript CLI stdout.
   */
  const parsed = JSON.parse(stdout,) as unknown;

  if (!isShownTsconfig(parsed,))
    throw new Error('TypeScript --showConfig must print a JSON object',);

  return parsed;
}

/**
 * Narrows resolved TypeScript config to current production mutate file.
 *
 * @param options - Resolved showConfig and package-relative mutate file.
 *
 * @returns Config object for Stryker's TypeScript checker.
 *
 * @example
 * ```ts
 * mutationTsconfig({ shownConfig: { include: ['src/**\/*.ts'] }, mutateFile: 'src/a.ts' });
 * // { files: ['src/a.ts'] }
 * ```
 */
export function mutationTsconfig(options: {
  readonly shownConfig: ShownTsconfig;
  readonly mutateFile: string;
},): ShownTsconfig {
  /**
   * ShowConfig object without inherited include patterns.
   */
  const {
    include: _include,
    ...configWithoutInclude
  } = options.shownConfig;

  return {
    ...configWithoutInclude,
    files: [options.mutateFile,],
  };
}

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
},): Promise<ShownTsconfig> {
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
  return parseShownTsconfig(result.stdout,);
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
 * await writeMutationTsconfig({
 *   packageCwd: '/work/packages/dev-script/file-enforcer',
 *   mutateFile: 'src/io/glob.ts',
 * });
 * // 'tsconfig.mutation.json'
 * ```
 */
export async function writeMutationTsconfig(options: {
  readonly packageCwd: string;
  readonly mutateFile: string;
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
  /**
   * Mutation-scoped checker config written for Stryker.
   */
  const config = mutationTsconfig({
    shownConfig,
    mutateFile: options.mutateFile,
  },);
  await writeFile(
    configPath,
    `${JSON.stringify(
      config,
      null,
      2,
    )}\n`,
    'utf8',
  );
  return MUTATION_TSCONFIG_NAME;
}
