/**
 Global Pi Search Fetch configuration loading.
 
 @module
 */

import { homedir, } from 'node:os';
import {
  EnvLocalJsonDecryptError,
  EnvLocalJsonMissingIdentityError,
  EnvLocalJsonPathError,
  EnvLocalJsonPlaintextError,
  EnvLocalJsonReadError,
  EnvLocalJsonShapeError,
  EnvLocalJsonSopsMissingError,
  readEnvLocalJson,
} from '@monochromatic-dev/module-env-local-json/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  EXA_API_KEY_ENV,
  LINKUP_API_KEY_ENV,
} from './config-constants.ts';
import {
  fileExists,
  readOptionalConfigJson,
} from './config-file.ts';
import {
  configPathForHome,
  legacyConfigPathForHome,
} from './config-paths.ts';
import {
  normalizeConfigBlocklist,
  resolveApiKey,
  SearchFetchMigrationRequiredError,
  validateConfigShape,
} from './config-schema.ts';
import type {
  ConfigJsonReadResult,
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
} from './config-types.ts';

/**
 Logger root for pi-search-fetch after removing the package log shim.
 
 @example
 ```ts
 const rl = tagged({ tag: someFunction.name, l: linkupLogger, },);
 ```
 */
const linkupLogger = tagged({ tag: 'pi-search-fetch', },);

/**
 Module logger.
 */
const l = tagged({
  tag: 'config',
  l: linkupLogger,
},);

//region Public API

/**
 Load Pi Search Fetch global config.
 
 @param options - optional environment, home, cwd, and store overrides for tests
 
 @returns loaded config with normalized blocklist and API key precedence
 
 @throws when the Pi config has invalid JSON or schema, a legacy credential shape,
 or the requested blocklist cannot be normalized
 
 @example
 ```ts
 loadLinkupConfig();
 ```
 */
async function loadLinkupConfig(options: LoadLinkupConfigOptions = {},): Promise<LinkupConfig> {
  /**
   Logger tagged for config loading.
   */
  const innerL = tagged({
    tag: loadLinkupConfig.name,
    l,
  },);
  /**
   Local value for processHome.
   */
  const processHome = process.env
    .HOME;
  /**
   Local value for home.
   */
  const home = options.home
    ?? processHome
    ?? homedir();
  /**
   Local value for env.
   */
  const env = options.env
    ?? process.env;
  /**
   Local value for cwd.
   */
  const cwd = options.cwd
    ?? process.cwd();
  /**
   Local value for configPath.
   */
  const configPath = configPathForHome({ home, },);
  /**
   Local value for readResult.
   */
  const readResult: ConfigJsonReadResult = await readOptionalConfigJson({ configPath, },);
  /**
   Local value for legacyPath.
   */
  const legacyPath = legacyConfigPathForHome({ home, },);
  if (!readResult.loaded && await fileExists({ filePath: legacyPath, },))
    throw new SearchFetchMigrationRequiredError({
      configPath: legacyPath,
      keys: ['apiKey',],
    },);
  /**
   Local value for configFile.
   */
  const configFile = readResult.loaded
    ? validateConfigShape({
      value: readResult.value,
      configPath,
    },)
    : {};
  /**
   Local value for blocklist.
   */
  const blocklist = normalizeConfigBlocklist({
    entries: configFile.blocklist ?? [],
    configPath,
  },);
  /**
   Requested provider keys that the environment did not supply.
   */
  const missingKeys = [
    EXA_API_KEY_ENV,
    LINKUP_API_KEY_ENV,
  ].filter(function isMissingFromEnv(envKey,) {
    /**
     Local value for value.
     */
    const value = env[envKey]
      ?.trim();
    return (value === undefined) || (value === '');
  },);
  /**
   Values read from the encrypted store.
   */
  let storeValues: Readonly<Record<string, string>> = {};
  /**
   Absolute store path when discovery found one.
   */
  let storePath: string | undefined;
  /**
   Whether the store was read and decrypted.
   */
  let storeLoaded = false;
  /**
   Value-free store diagnostic.
   */
  let storeError: string | undefined;
  if (missingKeys.length > 0) {
    try {
      /**
       Local value for storeResult.
       */
      const storeResult = await readEnvLocalJson({
        keys: missingKeys,
        cwd,
        env,
        home,
        ...(options.envLocalJsonPath === undefined ? {} : { path: options.envLocalJsonPath, }),
        ...(options.signal === undefined ? {} : { signal: options.signal, }),
      },);
      storeValues = storeResult.values;
      storePath = storeResult.path;
      storeLoaded = storeResult.loaded;
    }
    catch (error: unknown) {
      if (!isExpectedStoreError(error,))
        throw error;
      storeError = error.message;
      innerL.warn(`encrypted store unavailable: ${storeError}`,);
    }
  }
  /**
   Local value for exaApiKey.
   */
  const exaApiKey = resolveApiKey({
    env,
    envKey: EXA_API_KEY_ENV,
    ...(storeValues[EXA_API_KEY_ENV] === undefined
      ? {}
      : { storeValue: storeValues[EXA_API_KEY_ENV], }),
  },);
  /**
   Local value for linkupApiKey.
   */
  const linkupApiKey = resolveApiKey({
    env,
    envKey: LINKUP_API_KEY_ENV,
    ...(storeValues[LINKUP_API_KEY_ENV] === undefined
      ? {}
      : { storeValue: storeValues[LINKUP_API_KEY_ENV], }),
  },);
  /**
   Source metadata, with optional store facts only when discovery ran.
   */
  const source: LinkupConfigSource = {
    path: configPath,
    loaded: readResult.loaded,
    ...(storePath === undefined ? {} : { storePath, }),
    ...(storeLoaded ? { storeLoaded: true, } : {}),
    ...(storeError === undefined ? {} : { storeError, }),
  };

  innerL.debug(
    `loaded pi-search-fetch config from ${configPath}; present=${String(readResult.loaded,)}`
      + `${storePath === undefined ? '' : `; store=${storePath}`}`
      + `${storeError === undefined ? '' : '; store unavailable'}`,
  );
  return {
    ...(exaApiKey.configured ? { exaApiKey: exaApiKey.value, } : {}),
    ...(linkupApiKey.configured ? { linkupApiKey: linkupApiKey.value, } : {}),
    ...(exaApiKey.configured ? { exaApiKeyOrigin: exaApiKey.origin, } : {}),
    ...(linkupApiKey.configured ? { linkupApiKeyOrigin: linkupApiKey.origin, } : {}),
    blocklist,
    source,
  };
}

//endregion Public API

//region Helpers

/**
 Report whether an error is one of the store reader's expected failures.
 
 @param error - caught value
 
 @returns whether the loader may degrade to an unconfigured store
 
 @example
 ```ts
 isExpectedStoreError(new EnvLocalJsonPlaintextError({ path: '/tmp/store' }));
 ```
 */
function isExpectedStoreError(error: unknown,): error is Error {
  return (error instanceof EnvLocalJsonPathError)
    || (error instanceof EnvLocalJsonReadError)
    || (error instanceof EnvLocalJsonPlaintextError)
    || (error instanceof EnvLocalJsonSopsMissingError)
    || (error instanceof EnvLocalJsonMissingIdentityError)
    || (error instanceof EnvLocalJsonDecryptError)
    || (error instanceof EnvLocalJsonShapeError);
}

//endregion Helpers

export {
  loadLinkupConfig,
};
export type {
  LinkupConfig,
  LinkupConfigSource,
  LoadLinkupConfigOptions,
} from './config-types.ts';
