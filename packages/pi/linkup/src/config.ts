/**
 * Global Pi Linkup configuration loading.
 *
 * @module
 */

import { readFileSync, } from 'node:fs';
import { homedir, } from 'node:os';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { normalizeBlocklist, } from './domain-policy.ts';

/**
 * Logger root for pi-linkup after removing the package log shim.
 *
 * @example
 * ```ts
 * const rl = tagged({ tag: someFunction.name, l: linkupLogger, },);
 * ```
 */
const linkupLogger = tagged({ tag: 'pi-linkup', },);

//region Constants

/**
 * Environment variable that wins over config-file API keys.
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
 * Pi Linkup config filename.
 */
const PI_LINKUP_CONFIG_FILE = 'pi-linkup.json';

/**
 * Node error code for missing files.
 */
const FILE_NOT_FOUND_CODE = 'ENOENT';

/**
 * Valid top-level config keys.
 */
const CONFIG_KEYS = [
  'apiKey',
  'blocklist',
] as const;

/**
 * Valid top-level config key lookup.
 */
const CONFIG_KEY_SET = new Set<string>(CONFIG_KEYS,);

//endregion Constants

//region Types

/**
 * Loaded Pi Linkup config.
 */
type LinkupConfig = {
  /**
   * Optional API key after environment and file precedence are applied.
   */
  readonly apiKey?: string;
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
 * Pi Linkup config source metadata.
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
};

/**
 * Options for loading Pi Linkup config.
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
   * Optional fallback API key from config file.
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
 * Load Pi Linkup global config.
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
function loadLinkupConfig(options: LoadLinkupConfigOptions = {},): LinkupConfig {
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
   * Local value for readResult.
   */
  const readResult = readOptionalConfigJson({ configPath, },);
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
   * Local value for apiKey.
   */
  const apiKey = resolveApiKey({
    env,
    ...(configFile.apiKey === undefined ? {} : { configApiKey: configFile.apiKey, }),
  },);

  innerL.debug(`loaded pi-linkup config from ${configPath}; present=${String(readResult.loaded,)}`,);
  return {
    ...(apiKey.configured ? { apiKey: apiKey.value, } : {}),
    blocklist,
    source: {
      path: configPath,
      loaded: readResult.loaded,
    },
  };
}

/**
 * Resolve global Pi Linkup config path for a home directory.
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

//endregion Public API

//region File parsing

/**
 * Read and parse optional config JSON.
 *
 * @param configPath - absolute config path
 *
 * @returns parsed JSON result, or absent result when file is absent
 *
 * @throws when reading fails for a reason other than missing file or JSON parsing fails
 */
function readOptionalConfigJson({ configPath, }: { readonly configPath: string; }): ConfigJsonReadResult {
  try {
    /**
     * Local value for content.
     */
    const content = readFileSync(
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
    const detail = error instanceof Error
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
  return (error instanceof Error)
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
    const detail = error instanceof Error
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
 * @param configApiKey - optional config-file API key
 *
 * @returns effective API key resolution
 */
function resolveApiKey(
  {
    env,
    configApiKey,
  }: {
    readonly env: Readonly<NodeJS.ProcessEnv>;
    readonly configApiKey?: string;
  },
): ApiKeyResolution {
  /**
   * Local value for envApiKey.
   */
  const envApiKey = env[LINKUP_API_KEY_ENV]
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
  loadLinkupConfig,
};
export type {
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
};
