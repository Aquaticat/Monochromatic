/**
 * Pi Search Fetch config file parsing and migration.
 *
 * @module
 */

import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import {
  basename,
  dirname,
} from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import {
  CONFIG_JSON_INDENT_SPACES,
  FILE_NOT_FOUND_CODE,
} from './config-constants.ts';
import { legacyConfigPathForHome, } from './config-paths.ts';
import { validateLegacyConfigShape, } from './config-schema.ts';
import type {
  ConfigFileShape,
  ConfigJsonReadResult,
  ErrorWithCode,
  LegacyMigrationResult,
} from './config-types.ts';

/**
 * Migrate legacy Pi Linkup config into new Search Fetch config path when needed.
 *
 * @param home - home directory
 *
 * @param configPath - new config path
 *
 * @returns migration result
 *
 * @example
 * ```ts
 * await migrateLegacyConfigIfPresent({ home: '/tmp/home', configPath: '/tmp/home/new.json' });
 * ```
 */
async function migrateLegacyConfigIfPresent(
  {
    home,
    configPath,
  }: {
    readonly home: string;
    readonly configPath: string;
  },
): Promise<LegacyMigrationResult> {
  /**
   * Local value for legacyPath.
   */
  const legacyPath = legacyConfigPathForHome({ home, },);
  /**
   * Local value for legacyReadResult.
   */
  const legacyReadResult = await readOptionalConfigJson({ configPath: legacyPath, },);
  if (!legacyReadResult.loaded)
    return { migrated: false, };

  /**
   * Local value for legacyConfig.
   */
  const legacyConfig = validateLegacyConfigShape({
    value: legacyReadResult.value,
    configPath: legacyPath,
  },);
  /**
   * Local value for migratedValue.
   */
  const migratedValue: ConfigFileShape = {
    ...(legacyConfig.apiKey === undefined ? {} : { linkupApiKey: legacyConfig.apiKey, }),
    ...(legacyConfig.blocklist === undefined ? {} : { blocklist: legacyConfig.blocklist, }),
  };

  await mkdir(
    dirname(configPath,),
    { recursive: true, },
  );
  await writeFile(
    configPath,
    `${JSON.stringify(
      migratedValue,
      null,
      CONFIG_JSON_INDENT_SPACES,
    )}\n`,
    'utf8',
  );
  await removeLegacyConfig({ legacyPath, },);
  return {
    migrated: true,
    value: migratedValue,
    legacyPath,
  };
}

/**
 * Remove migrated legacy config when it is still present.
 *
 * @param legacyPath - legacy config path
 */
async function removeLegacyConfig({ legacyPath, }: { readonly legacyPath: string; }): Promise<void> {
  try {
    await unlink(legacyPath,);
  }
  catch (error: unknown) {
    if (isMissingFileError(error,))
      return;
    throw error;
  }
}

/**
 * Read and parse optional config JSON.
 *
 * @param configPath - absolute config path
 *
 * @returns parsed JSON result, or absent result when file is absent
 *
 * @throws when reading fails for reason other than missing file or JSON parsing fails
 *
 * @example
 * ```ts
 * await readOptionalConfigJson({ configPath: '/tmp/pi-search-fetch.json' });
 * ```
 */
async function readOptionalConfigJson(
  { configPath, }: { readonly configPath: string; },
): Promise<ConfigJsonReadResult> {
  try {
    /**
     * Local value for content.
     */
    const content = await readFile(
      configPath,
      'utf8',
    );
    return {
      loaded: true,
      value: parseConfigJson({
        content,
        configPath,
      },),
    };
  }
  catch (error: unknown) {
    if (isMissingFileError(error,))
      return { loaded: false, };
    throw error;
  }
}

/**
 * Parse config JSON content.
 *
 * @param content - raw file content
 *
 * @param configPath - config path used in diagnostics
 *
 * @returns parsed JSON value
 */
function parseConfigJson(
  {
    content,
    configPath,
  }: {
    readonly content: string;
    readonly configPath: string;
  },
): unknown {
  try {
    return JSON.parse(content,) as unknown;
  }
  catch (error: unknown) {
    /**
     * Local value for detail.
     */
    const detail = caughtValueText(error,);
    throw new Error(
      `${basename(configPath,)} parsing failed at ${configPath}: ${detail}`,
      { cause: error, },
    );
  }
}

/**
 * Return whether error is a missing-file filesystem error.
 *
 * @param error - unknown read error
 *
 * @returns whether error has ENOENT code
 */
function isMissingFileError(error: unknown,): boolean {
  return isErrorWithCode(error,)
    && (error.code === FILE_NOT_FOUND_CODE);
}

/**
 * Return whether error is an Error with a system code.
 *
 * @param error - unknown error
 *
 * @returns whether error has a code property
 */
function isErrorWithCode(error: unknown,): error is ErrorWithCode {
  return (Error.isError(error,))
    && ('code' in error);
}

export {
  migrateLegacyConfigIfPresent,
  readOptionalConfigJson,
};
