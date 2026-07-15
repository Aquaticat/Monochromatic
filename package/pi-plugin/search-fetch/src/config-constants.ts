/**
 * Pi Search Fetch config constants.
 *
 * @module
 */

import { join, } from 'node:path';

/**
 * Environment variable that wins over config-file Exa API keys.
 */
const EXA_API_KEY_ENV = 'EXA_API_KEY';

/**
 * Environment variable that wins over config-file Linkup API keys.
 */
const LINKUP_API_KEY_ENV = 'LINKUP_API_KEY';

/**
 * Directory below home that stores global Pi extension config.
 */
const PI_EXTENSION_CONFIG_DIR: string = join(
  '.pi',
  'agent',
  'extensions',
);

/**
 * Pi Search Fetch config filename.
 */
const PI_SEARCH_FETCH_CONFIG_FILE = 'pi-search-fetch.json';

/**
 * Legacy Pi Linkup config filename migrated once when present.
 */
const LEGACY_PI_LINKUP_CONFIG_FILE = 'pi-linkup.json';

/**
 * JSON indentation used when writing migrated config.
 */
const CONFIG_JSON_INDENT_SPACES = 2;

/**
 * Node error code for missing files.
 */
const FILE_NOT_FOUND_CODE = 'ENOENT';

/**
 * Valid top-level config keys.
 */
const CONFIG_KEYS = [
  'exaApiKey',
  'linkupApiKey',
  'blocklist',
] as const;

/**
 * Valid legacy top-level config keys.
 */
const LEGACY_CONFIG_KEYS = [
  'apiKey',
  'blocklist',
] as const;

/**
 * Valid top-level config key lookup.
 */
const CONFIG_KEY_SET: ReadonlySet<string> = new Set<string>(CONFIG_KEYS,);

/**
 * Valid legacy top-level config key lookup.
 */
const LEGACY_CONFIG_KEY_SET: ReadonlySet<string> = new Set<string>(LEGACY_CONFIG_KEYS,);

export {
  CONFIG_JSON_INDENT_SPACES,
  CONFIG_KEY_SET,
  EXA_API_KEY_ENV,
  FILE_NOT_FOUND_CODE,
  LEGACY_CONFIG_KEY_SET,
  LEGACY_PI_LINKUP_CONFIG_FILE,
  LINKUP_API_KEY_ENV,
  PI_EXTENSION_CONFIG_DIR,
  PI_SEARCH_FETCH_CONFIG_FILE,
};
