/**
 * Unit tests for Pi Search Fetch config loading.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  readFile,
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
 * Config API key fixture.
 */
const CONFIG_API_KEY = 'config-key';

/**
 * Environment API key fixture.
 */
const ENV_API_KEY = 'env-key';

/**
 * Blocklist entry fixture.
 */
const BLOCKLIST_ENTRY = 'badwikipedia.invalid';

/**
 * Invalid blocklist entry fixture.
 */
const INVALID_BLOCKLIST_ENTRY = 'badwikipedia.invalid:443';

//endregion Fixtures

await describe({
  name: loadLinkupConfig.name,
  children: [
    it({
      name: 'uses empty blocklist and no config API key when config is absent',
      fn: async () => {
        /**
         * Local value for home.
         */
        const home = await tempHome();
        /**
         * Local value for config.
         */
        const config = await loadLinkupConfig({
          home,
          env: {},
        },);

        expect(config.exaApiKey,).toBeUndefined();
        expect(config.linkupApiKey,).toBeUndefined();
        expect(config.blocklist,).toEqual([],);
        expect(config.source.loaded,).toBe(false,);
      },
    },),
    it({
      name: 'lets environment API keys beat config API keys',
      fn: async () => {
        /**
         * Local value for home.
         */
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            exaApiKey: CONFIG_API_KEY,
            linkupApiKey: CONFIG_API_KEY,
          },
        },);

        /**
         * Local value for config.
         */
        const config = await loadLinkupConfig({
          home,
          env: {
            EXA_API_KEY: ENV_API_KEY,
            LINKUP_API_KEY: ENV_API_KEY,
          },
        },);

        expect(config.exaApiKey,).toBe(ENV_API_KEY,);
        expect(config.linkupApiKey,).toBe(ENV_API_KEY,);
      },
    },),
    it({
      name: 'loads flat provider keys and blocklist config',
      fn: async () => {
        /**
         * Local value for home.
         */
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            exaApiKey: CONFIG_API_KEY,
            linkupApiKey: CONFIG_API_KEY,
            blocklist: [BLOCKLIST_ENTRY,],
          },
        },);

        /**
         * Local value for config.
         */
        const config = await loadLinkupConfig({
          home,
          env: {},
        },);

        expect(config.exaApiKey,).toBe(CONFIG_API_KEY,);
        expect(config.linkupApiKey,).toBe(CONFIG_API_KEY,);
        expect(config.blocklist,).toEqual([BLOCKLIST_ENTRY,],);
        expect(config.source.path,).toBe(configPathForHome({ home, },),);
        expect(config.source.loaded,).toBe(true,);
      },
    },),
    it({
      name: 'migrates legacy config into new config path',
      fn: async () => {
        /**
         * Local value for home.
         */
        const home = await tempHome();
        await writeLegacyConfig({
          home,
          value: {
            apiKey: CONFIG_API_KEY,
            blocklist: [BLOCKLIST_ENTRY,],
          },
        },);

        /**
         * Local value for config.
         */
        const config = await loadLinkupConfig({
          home,
          env: {},
        },);
        /**
         * Local value for migratedContent.
         */
        const migratedContent = JSON.parse(
          await readFile(configPathForHome({ home, },), 'utf8',),
        ) as Record<string, unknown>;

        expect(config.linkupApiKey,).toBe(CONFIG_API_KEY,);
        expect(config.blocklist,).toEqual([BLOCKLIST_ENTRY,],);
        expect(config.source.migratedFrom,).toBe(legacyConfigPathForHome({ home, },),);
        expect(migratedContent.linkupApiKey,).toBe(CONFIG_API_KEY,);
      },
    },),
    it({
      name: 'reports invalid JSON with config path and parsing phase',
      fn: async () => {
        /**
         * Local value for home.
         */
        const home = await tempHome();
        /**
         * Local value for configPath.
         */
        const configPath = configPathForHome({ home, },);
        await mkdir(dirname(configPath,), { recursive: true, },);
        await writeFile(configPath, '{',);

        let caught: unknown;
        try {
          await loadLinkupConfig({
            home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('pi-search-fetch.json',);
        expect((caught as Error).message,).toContain('parsing',);
        expect((caught as Error).message,).toContain(configPath,);
      },
    },),
    it({
      name: 'reports invalid blocklist entry with offending entry',
      fn: async () => {
        /**
         * Local value for home.
         */
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            blocklist: [INVALID_BLOCKLIST_ENTRY,],
          },
        },);

        let caught: unknown;
        try {
          await loadLinkupConfig({
            home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('pi-search-fetch.json',);
        expect((caught as Error).message,).toContain('blocklist normalization',);
        expect((caught as Error).message,).toContain(INVALID_BLOCKLIST_ENTRY,);
      },
    },),
  ],
},);

//region Helpers

/**
 * Create an isolated home directory.
 *
 * @returns temp home path
 */
async function tempHome(): Promise<string> {
  return mkdtemp(join(
    tmpdir(),
    'pi-search-fetch-config-test-',
  ),);
}

/**
 * Write Pi Search Fetch config under a temp home.
 *
 * @param home - temp home directory
 *
 * @param value - JSON-serializable config value
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
   * Local value for configPath.
   */
  const configPath = configPathForHome({ home, },);
  await mkdir(dirname(configPath,), { recursive: true, },);
  await writeFile(
    configPath,
    JSON.stringify(value,),
  );
}

/**
 * Write legacy Pi Linkup config under a temp home.
 *
 * @param home - temp home directory
 *
 * @param value - JSON-serializable config value
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
   * Local value for configPath.
   */
  const configPath = legacyConfigPathForHome({ home, },);
  await mkdir(dirname(configPath,), { recursive: true, },);
  await writeFile(
    configPath,
    JSON.stringify(value,),
  );
}

//endregion Helpers
