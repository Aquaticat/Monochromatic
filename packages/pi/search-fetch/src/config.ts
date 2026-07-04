/**
 * Global Pi Search Fetch configuration loading.
 *
 * @module
 */

import { homedir, } from 'node:os';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  EXA_API_KEY_ENV,
  LINKUP_API_KEY_ENV,
} from './config-constants.ts';
import {
  migrateLegacyConfigIfPresent,
  readOptionalConfigJson,
} from './config-file.ts';
import {
  configPathForHome,
  legacyConfigPathForHome,
} from './config-paths.ts';
import {
  normalizeConfigBlocklist,
  resolveApiKey,
  validateConfigShape,
} from './config-schema.ts';
import type {
  ConfigJsonReadResult,
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
} from './config-types.ts';

/**
 * Logger root for pi-search-fetch after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: linkupLogger, },);
 * ```
 */
const linkupLogger = tagged({ tag: 'pi-search-fetch', },);

/**
 * Module logger.
 */
const l = tagged({
  tag: 'config',
  l: linkupLogger,
},);

//region Public API

/**
 * Load Pi Search Fetch global config.
 *
 * @param options - optional environment and home overrides for tests
 *
 * @returns loaded config with normalized blocklist and API key precedence
 *
 * @throws when config file has invalid JSON, schema, or blocklist entries
 *
 * @example
 * ```ts
 * loadLinkupConfig();
 * ```
 */
async function loadLinkupConfig(options: LoadLinkupConfigOptions = {},): Promise<LinkupConfig> {
  /**
   * Logger tagged for config loading.
   */
  const innerL = tagged({
    tag: loadLinkupConfig.name,
    l,
  },);
  /**
   * Local value for processHome.
   */
  const processHome = process.env
    .HOME;
  /**
   * Local value for home.
   */
  const home = options.home
    ?? processHome
    ?? homedir();
  /**
   * Local value for env.
   */
  const env = options.env
    ?? process.env;
  /**
   * Local value for configPath.
   */
  const configPath = configPathForHome({ home, },);
  /**
   * Local value for initialReadResult.
   */
  const initialReadResult = await readOptionalConfigJson({ configPath, },);
  /**
   * Local value for migration.
   */
  const migration = initialReadResult.loaded
    ? { migrated: false, } as const
    : await migrateLegacyConfigIfPresent({
      home,
      configPath,
    },);
  /**
   * Local value for readResult.
   */
  const readResult: ConfigJsonReadResult = migration.migrated
    ? {
      loaded: true,
      value: migration.value,
    }
    : initialReadResult;
  /**
   * Local value for configFile.
   */
  const configFile = readResult.loaded
    ? validateConfigShape({
      value: readResult.value,
      configPath,
    },)
    : {};
  /**
   * Local value for blocklist.
   */
  const blocklist = normalizeConfigBlocklist({
    entries: configFile.blocklist ?? [],
    configPath,
  },);
  /**
   * Local value for exaApiKey.
   */
  const exaApiKey = resolveApiKey({
    env,
    envKey: EXA_API_KEY_ENV,
    ...(configFile.exaApiKey === undefined ? {} : { configApiKey: configFile.exaApiKey, }),
  },);
  /**
   * Local value for linkupApiKey.
   */
  const linkupApiKey = resolveApiKey({
    env,
    envKey: LINKUP_API_KEY_ENV,
    ...(configFile.linkupApiKey === undefined ? {} : { configApiKey: configFile.linkupApiKey, }),
  },);

  innerL.debug(
    `loaded pi-search-fetch config from ${configPath}; present=${String(readResult.loaded,)}`,
  );
  return {
    ...(exaApiKey.configured ? { exaApiKey: exaApiKey.value, } : {}),
    ...(linkupApiKey.configured ? { linkupApiKey: linkupApiKey.value, } : {}),
    blocklist,
    source: {
      path: configPath,
      loaded: readResult.loaded,
      ...(migration.migrated ? { migratedFrom: migration.legacyPath, } : {}),
    },
  };
}

//endregion Public API

export {
  loadLinkupConfig,
};
export type {
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
} from './config-types.ts';
