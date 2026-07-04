/**
 * Global Pi Search Fetch configuration loading.
 *
 * @module
 */

import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  dirname,
  join,
} from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { normalizeBlocklist, } from './domain-policy.ts';

/**
 * Logger root for pi-search-fetch after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: linkupLogger, },);
 * ```
 */
const linkupLogger = tagged({ tag: 'pi-search-fetch', },);

//region Constants

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
const PI_EXTENSION_CONFIG_DIR = join(
  '.pi',
  'agent',
  'extensions',
);

/**
 * Pi Search Fetch config filename.
 */
const PI_LINKUP_CONFIG_FILE = 'pi-search-fetch.json';

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
const CONFIG_KEY_SET = new Set<string>(CONFIG_KEYS,);

/**
 * Valid legacy top-level config key lookup.
 */
const LEGACY_CONFIG_KEY_SET = new Set<string>(LEGACY_CONFIG_KEYS,);

//endregion Constants

//region Types

/**
 * Loaded Pi Search Fetch config.
 */
type LinkupConfig = {
  /**
   * Optional Exa API key after environment and file precedence are applied.
   */
  readonly exaApiKey?: string;
  /**
   * Optional Linkup API key after environment and file precedence are applied.
   */
  readonly linkupApiKey?: string;
  /**
   * Normalized global host suffix blocklist.
   */
  readonly blocklist: readonly string[];
  /**
   * Source metadata useful for diagnostics.
   */
  readonly source: LinkupConfigSource;
};

/**
 * Pi Search Fetch config source metadata.
 */
type LinkupConfigSource = {
  /**
   * Absolute config file path checked by the loader.
   */
  readonly path: string;
  /**
   * Whether config file existed and loaded successfully.
   */
  readonly loaded: boolean;
  /**
   * Legacy config path migrated into this source, when migration happened.
   */
  readonly migratedFrom?: string;
};

/**
 * Options for loading Pi Search Fetch config.
 */
type LoadLinkupConfigOptions = {
  /**
   * Home directory used to resolve global Pi config.
   */
  readonly home?: string;
  /**
   * Environment used for API key precedence.
   */
  readonly env?: Readonly<NodeJS.ProcessEnv>;
};

/**
 * Parsed config-file shape after schema validation.
 */
type ConfigFileShape = {
  /**
   * Optional Exa API key from config file.
   */
  readonly exaApiKey?: string;
  /**
   * Optional Linkup API key from config file.
   */
  readonly linkupApiKey?: string;
  /**
   * Optional raw host suffix blocklist.
   */
  readonly blocklist?: readonly string[];
};

/**
 * Parsed legacy config-file shape after schema validation.
 */
type LegacyConfigFileShape = {
  /**
   * Optional legacy Linkup API key from config file.
   */
  readonly apiKey?: string;
  /**
   * Optional raw host suffix blocklist.
   */
  readonly blocklist?: readonly string[];
};

/**
 * Optional parsed config JSON result.
 */
type ConfigJsonReadResult = {
  /**
   * Whether config file loaded.
   */
  readonly loaded: false;
} | {
  /**
   * Whether config file loaded.
   */
  readonly loaded: true;
  /**
   * Parsed JSON value.
   */
  readonly value: unknown;
};

/**
 * API key resolution result.
 */
type ApiKeyResolution = {
  /**
   * Whether an API key was configured.
   */
  readonly configured: false;
} | {
  /**
   * Whether an API key was configured.
   */
  readonly configured: true;
  /**
   * Effective API key.
   */
  readonly value: string;
};

/**
 * Legacy migration result.
 */
type LegacyMigrationResult = {
  /**
   * Whether legacy config migrated.
   */
  readonly migrated: false;
} | {
  /**
   * Whether legacy config migrated.
   */
  readonly migrated: true;
  /**
   * Migrated new config shape.
   */
  readonly value: ConfigFileShape;
  /**
   * Legacy config path consumed by migration.
   */
  readonly legacyPath: string;
};

/**
 * Error object with a Node system code.
 */
type ErrorWithCode = Error & {
  /**
   * Node system code.
   */
  readonly code: unknown;
};

//endregion Types

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
   * Local value for innerL.
   */
  const innerL = tagged({
    tag: loadLinkupConfig.name,
    l,
  },);
  /**
   * Local value for home.
   */
  const home = options.home
    ?? process.env
    .HOME
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

  innerL.debug(`loaded pi-search-fetch config from ${configPath}; present=${String(readResult.loaded,)}`,
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

/**
 * Resolve global Pi Search Fetch config path for a home directory.
 *
 * @param home - home directory
 *
 * @returns absolute config path
 *
 * @example
 * ```ts
 * configPathForHome({ home: '/home/user' });
 * ```
 */
function configPathForHome({ home, }: { readonly home: string; }): string {
  return join(
    home,
    PI_EXTENSION_CONFIG_DIR,
    PI_LINKUP_CONFIG_FILE,
  );
}

/**
 * Resolve legacy Pi Linkup config path for a home directory.
 *
 * @param home - home directory
 *
 * @returns absolute legacy config path
 *
 * @example
 * ```ts
 * legacyConfigPathForHome({ home: '/home/user' });
 * ```
 */
function legacyConfigPathForHome({ home, }: { readonly home: string; }): string {
  return join(
    home,
    PI_EXTENSION_CONFIG_DIR,
    LEGACY_PI_LINKUP_CONFIG_FILE,
  );
}

//endregion Public API

//region File parsing

/**
 * Migrate legacy Pi Linkup config into the new Search Fetch config path when needed.
 *
 * @param home - home directory
 *
 * @param configPath - new config path
 *
 * @returns migration result
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

  await mkdir(dirname(configPath,), { recursive: true, },);
  await writeFile(
    configPath,
    `${JSON.stringify(migratedValue, null, CONFIG_JSON_INDENT_SPACES,)}\n`,
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
 * @throws when reading fails for a reason other than missing file or JSON parsing fails
 */
async function readOptionalConfigJson({ configPath, }: { readonly configPath: string; }): Promise<ConfigJsonReadResult> {
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
    const detail = Error.isError(error,)
      ? error.message
      : String(error,);
    throw new Error(
      `${PI_LINKUP_CONFIG_FILE} parsing failed at ${configPath}: ${detail}`,
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

//endregion File parsing

//region Schema validation

/**
 * Validate parsed config-file shape.
 *
 * @param value - parsed JSON value
 *
 * @param configPath - config path used in diagnostics
 *
 * @returns config-file shape
 *
 * @throws when value is not expected flat object
 */
function validateConfigShape(
  {
    value,
    configPath,
  }: {
    readonly value: unknown;
    readonly configPath: string;
  },
): ConfigFileShape {
  if (!isRecord(value,))
    throw schemaError({
      configPath,
      reason: 'root value must be an object',
    },);

  /**
   * Local value for extraKeys.
   */
  const extraKeys = Object
    .keys(value,)
    .filter(function isExtraKey(key,) {
      return !CONFIG_KEY_SET.has(key,);
    },);
  if (extraKeys.length > 0)
    throw schemaError({
      configPath,
      reason: `unsupported keys: ${extraKeys.join(', ',)}`,
    },);

  /**
   * Local destructured value.
   */
  const {
    exaApiKey,
    linkupApiKey,
    blocklist,
  } = value;
  if ((exaApiKey !== undefined) && ((typeof exaApiKey) !== 'string'))
    throw schemaError({
      configPath,
      reason: 'exaApiKey must be a string when present',
    },);
  if ((linkupApiKey !== undefined) && ((typeof linkupApiKey) !== 'string'))
    throw schemaError({
      configPath,
      reason: 'linkupApiKey must be a string when present',
    },);
  if ((blocklist !== undefined) && (!isStringArray(blocklist,)))
    throw schemaError({
      configPath,
      reason: 'blocklist must be an array of strings when present',
    },);

  return {
    ...(exaApiKey === undefined ? {} : { exaApiKey, }),
    ...(linkupApiKey === undefined ? {} : { linkupApiKey, }),
    ...(blocklist === undefined ? {} : { blocklist, }),
  };
}

/**
 * Validate parsed legacy config-file shape.
 *
 * @param value - parsed JSON value
 *
 * @param configPath - config path used in diagnostics
 *
 * @returns legacy config-file shape
 *
 * @throws when value is not expected flat object
 */
function validateLegacyConfigShape(
  {
    value,
    configPath,
  }: {
    readonly value: unknown;
    readonly configPath: string;
  },
): LegacyConfigFileShape {
  if (!isRecord(value,))
    throw schemaError({
      configPath,
      reason: 'root value must be an object',
    },);

  /**
   * Local value for extraKeys.
   */
  const extraKeys = Object
    .keys(value,)
    .filter(function isExtraKey(key,) {
      return !LEGACY_CONFIG_KEY_SET.has(key,);
    },);
  if (extraKeys.length > 0)
    throw schemaError({
      configPath,
      reason: `unsupported keys: ${extraKeys.join(', ',)}`,
    },);

  /**
   * Local destructured value.
   */
  const {
    apiKey,
    blocklist,
  } = value;
  if ((apiKey !== undefined) && ((typeof apiKey) !== 'string'))
    throw schemaError({
      configPath,
      reason: 'apiKey must be a string when present',
    },);
  if ((blocklist !== undefined) && (!isStringArray(blocklist,)))
    throw schemaError({
      configPath,
      reason: 'blocklist must be an array of strings when present',
    },);

  return {
    ...(apiKey === undefined ? {} : { apiKey, }),
    ...(blocklist === undefined ? {} : { blocklist, }),
  };
}

/**
 * Build a schema-validation error with config context.
 *
 * @param configPath - config path used in diagnostics
 *
 * @param reason - validation failure summary
 *
 * @returns schema-validation error
 */
function schemaError(
  {
    configPath,
    reason,
  }: {
    readonly configPath: string;
    readonly reason: string;
  },
): Error {
  return new Error(`${PI_LINKUP_CONFIG_FILE} schema validation failed at ${configPath}: ${reason}`,);
}

/**
 * Return whether value is a non-null object record.
 *
 * @param value - unknown value
 *
 * @returns whether value can be read by string keys
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

/**
 * Return whether value is an array of strings.
 *
 * @param value - unknown value
 *
 * @returns whether value is a readonly string array
 */
function isStringArray(value: unknown,): value is readonly string[] {
  return Array.isArray(value,)
    && value.every(function isString(item,) {
      return (typeof item) === 'string';
    },);
}

//endregion Schema validation

//region Value normalization

/**
 * Normalize blocklist from config and wrap failures with config context.
 *
 * @param entries - raw blocklist entries
 *
 * @param configPath - config path used in diagnostics
 *
 * @returns normalized host suffix blocklist
 *
 * @throws when blocklist normalization rejects an entry
 */
function normalizeConfigBlocklist(
  {
    entries,
    configPath,
  }: {
    readonly entries: readonly string[];
    readonly configPath: string;
  },
): readonly string[] {
  try {
    return normalizeBlocklist(entries,);
  }
  catch (error: unknown) {
    /**
     * Local value for detail.
     */
    const detail = Error.isError(error,)
      ? error.message
      : String(error,);
    throw new Error(
      `${PI_LINKUP_CONFIG_FILE} blocklist normalization failed at ${configPath}: ${detail}`,
      { cause: error, },
    );
  }
}

/**
 * Resolve API key precedence.
 *
 * @param env - environment values
 *
 * @param envKey - environment key to check
 *
 * @param configApiKey - optional config-file API key
 *
 * @returns effective API key resolution
 */
function resolveApiKey(
  {
    env,
    envKey,
    configApiKey,
  }: {
    readonly env: Readonly<NodeJS.ProcessEnv>;
    readonly envKey: string;
    readonly configApiKey?: string;
  },
): ApiKeyResolution {
  /**
   * Local value for envApiKey.
   */
  const envApiKey = env[envKey]
    ?.trim();
  if ((envApiKey !== undefined) && (envApiKey !== ''))
    return {
      configured: true,
      value: envApiKey,
    };

  /**
   * Local value for fileApiKey.
   */
  const fileApiKey = configApiKey?.trim();
  if ((fileApiKey === undefined) || (fileApiKey === ''))
    return { configured: false, };
  return {
    configured: true,
    value: fileApiKey,
  };
}

//endregion Value normalization

export {
  configPathForHome,
  legacyConfigPathForHome,
  loadLinkupConfig,
};
export type {
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
};
