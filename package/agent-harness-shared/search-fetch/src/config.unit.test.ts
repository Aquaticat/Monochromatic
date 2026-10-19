/**
 Unit tests for Pi Search Fetch config loading without the encrypted store.
 
 @module
 */

import {
  mkdir,
  mkdtemp,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { dirname, join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  configPathForHome,
  legacyConfigPathForHome,
  loadLinkupConfig,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 Environment API key fixture.
 */
const ENV_API_KEY = 'env-key-sentinel';

/**
 Blocklist entry fixture.
 */
const BLOCKLIST_ENTRY = 'badwikipedia.invalid';

/**
 Invalid blocklist entry fixture.
 */
const INVALID_BLOCKLIST_ENTRY = 'badwikipedia.invalid:443';

/**
 Deprecated credential value sentinel.
 */
const DEPRECATED_SENTINEL = 'deprecated-credential-sentinel';

//endregion Fixtures

await describe({
  name: loadLinkupConfig.name,
  children: [
    it({
      name: 'uses empty blocklist and no keys when config and store are absent',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();

        /**
         Local value for config.
         */
        const config = await loadLinkupConfig({
          home,
          cwd: home,
          env: {},
        },);

        expect(config.exaApiKey,).toBeUndefined();
        expect(config.linkupApiKey,).toBeUndefined();
        expect(config.blocklist,).toEqual([],);
        expect(config.source.loaded,).toBe(false,);
      },
    },),
    it({
      name: 'lets environment API keys configure both providers',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();

        /**
         Local value for config.
         */
        const config = await loadLinkupConfig({
          home,
          cwd: home,
          env: {
            EXA_API_KEY: ENV_API_KEY,
            LINKUP_API_KEY: ENV_API_KEY,
          },
        },);

        expect(config.exaApiKey,).toBe(ENV_API_KEY,);
        expect(config.linkupApiKey,).toBe(ENV_API_KEY,);
        expect(config.exaApiKeyOrigin,).toBe('env',);
        expect(config.linkupApiKeyOrigin,).toBe('env',);
      },
    },),
    it({
      name: 'loads the blocklist from the Pi config',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();
        await writeConfig({
          home,
          value: { blocklist: [BLOCKLIST_ENTRY,], },
        },);

        /**
         Local value for config.
         */
        const config = await loadLinkupConfig({
          home,
          cwd: home,
          env: {},
        },);

        expect(config.blocklist,).toEqual([BLOCKLIST_ENTRY,],);
        expect(config.source.path,).toBe(configPathForHome({ home, },),);
        expect(config.source.loaded,).toBe(true,);
      },
    },),
    it({
      name: 'rejects a deprecated Exa credential field with the migration command',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            exaApiKey: DEPRECATED_SENTINEL,
            blocklist: [],
          },
        },);

        /**
         Local value for caught.
         */
        let caught: unknown;
        try {
          await loadLinkupConfig({
            home,
            cwd: home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect((caught as Error | undefined)?.name,).toBe('SearchFetchMigrationRequiredError',);
        expect((caught as Error | undefined)?.message,).toContain('exaApiKey',);
        expect((caught as Error | undefined)?.message,).toContain('mise run secrets:migrate',);
        expect((caught as Error | undefined)?.message,).not.toContain(DEPRECATED_SENTINEL,);
      },
    },),
    it({
      name: 'rejects a deprecated Linkup credential field',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            linkupApiKey: DEPRECATED_SENTINEL,
            blocklist: [],
          },
        },);

        /**
         Local value for caught.
         */
        let caught: unknown;
        try {
          await loadLinkupConfig({
            home,
            cwd: home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect((caught as Error | undefined)?.message,).toContain('linkupApiKey',);
        expect((caught as Error | undefined)?.message,).toContain('mise run secrets:migrate',);
      },
    },),
    it({
      name: 'rejects a legacy pi-linkup config with the migration command',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();
        await writeLegacyConfig({
          home,
          value: {
            apiKey: DEPRECATED_SENTINEL,
            blocklist: [],
          },
        },);

        /**
         Local value for caught.
         */
        let caught: unknown;
        try {
          await loadLinkupConfig({
            home,
            cwd: home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect((caught as Error | undefined)?.name,).toBe('SearchFetchMigrationRequiredError',);
        expect((caught as Error | undefined)?.message,).toContain('pi-linkup.json',);
        expect((caught as Error | undefined)?.message,).not.toContain(DEPRECATED_SENTINEL,);
      },
    },),
    it({
      name: 'reports invalid JSON with the Pi config path',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();
        /**
         Local value for configPath.
         */
        const configPath = configPathForHome({ home, },);
        await mkdir(dirname(configPath,), { recursive: true, },);
        await writeFile(configPath, '{',);

        /**
         Local value for caught.
         */
        let caught: unknown;
        try {
          await loadLinkupConfig({
            home,
            cwd: home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect((caught as Error | undefined)?.message,).toContain('pi-search-fetch.json',);
        expect((caught as Error | undefined)?.message,).toContain('parsing',);
        expect((caught as Error | undefined)?.message,).toContain(configPath,);
      },
    },),
    it({
      name: 'reports an invalid blocklist entry',
      fn: async () => {
        /**
         Local value for home.
         */
        const home = await tempHome();
        await writeConfig({
          home,
          value: { blocklist: [INVALID_BLOCKLIST_ENTRY,], },
        },);

        /**
         Local value for caught.
         */
        let caught: unknown;
        try {
          await loadLinkupConfig({
            home,
            cwd: home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect((caught as Error | undefined)?.message,).toContain('pi-search-fetch.json',);
        expect((caught as Error | undefined)?.message,).toContain('blocklist normalization',);
      },
    },),
  ],
},);

//region Helpers

/**
 Create an isolated home directory.
 
 @returns temp home path
 */
async function tempHome(): Promise<string> {
  return mkdtemp(join(
    tmpdir(),
    'pi-search-fetch-config-test-',
  ),);
}

/**
 Write Pi config under a temp home.
 
 @param home - temp home directory
 
 @param value - JSON-serializable config value
 */
async function writeConfig(
  {
    home,
    value,
  }: {
    readonly home: string;
    readonly value: unknown;
  },
): Promise<void> {
  /**
   Local value for configPath.
   */
  const configPath = configPathForHome({ home, },);
  await mkdir(dirname(configPath,), { recursive: true, },);
  await writeFile(configPath, JSON.stringify(value,), 'utf8',);
}

/**
 Write legacy Pi Linkup config under a temp home.
 
 @param home - temp home directory
 
 @param value - JSON-serializable config value
 */
async function writeLegacyConfig(
  {
    home,
    value,
  }: {
    readonly home: string;
    readonly value: unknown;
  },
): Promise<void> {
  /**
   Local value for configPath.
   */
  const configPath = legacyConfigPathForHome({ home, },);
  await mkdir(dirname(configPath,), { recursive: true, },);
  await writeFile(configPath, JSON.stringify(value,), 'utf8',);
}

//endregion Helpers
