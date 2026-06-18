/**
 * Unit tests for Pi Linkup config loading.
 *
 * @module
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
  loadLinkupConfig,
} from '../dist/final/node/index.mjs';

//region Fixtures

/** Config API key fixture. */
const CONFIG_API_KEY = 'config-key';

/** Environment API key fixture. */
const ENV_API_KEY = 'env-key';

/** Blocklist entry fixture. */
const BLOCKLIST_ENTRY = 'badwikipedia.invalid';

/** Invalid blocklist entry fixture. */
const INVALID_BLOCKLIST_ENTRY = 'badwikipedia.invalid:443';

//endregion Fixtures

await describe({
  name: loadLinkupConfig.name,
  children: [
    it({
      name: 'uses empty blocklist and no config API key when config is absent',
      fn: async () => {
        const home = await tempHome();
        const config = loadLinkupConfig({
          home,
          env: {},
        },);

        expect(config.apiKey,).toBeUndefined();
        expect(config.blocklist,).toEqual([],);
        expect(config.source.loaded,).toBe(false,);
      },
    },),
    it({
      name: 'lets environment API key beat config API key',
      fn: async () => {
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            apiKey: CONFIG_API_KEY,
          },
        },);

        const config = loadLinkupConfig({
          home,
          env: {
            LINKUP_API_KEY: ENV_API_KEY,
          },
        },);

        expect(config.apiKey,).toBe(ENV_API_KEY,);
      },
    },),
    it({
      name: 'loads flat apiKey and blocklist config',
      fn: async () => {
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            apiKey: CONFIG_API_KEY,
            blocklist: [BLOCKLIST_ENTRY,],
          },
        },);

        const config = loadLinkupConfig({
          home,
          env: {},
        },);

        expect(config.apiKey,).toBe(CONFIG_API_KEY,);
        expect(config.blocklist,).toEqual([BLOCKLIST_ENTRY,],);
        expect(config.source.path,).toBe(configPathForHome({ home, },),);
        expect(config.source.loaded,).toBe(true,);
      },
    },),
    it({
      name: 'reports invalid JSON with config path and parsing phase',
      fn: async () => {
        const home = await tempHome();
        const configPath = configPathForHome({ home, },);
        await mkdir(dirname(configPath,), { recursive: true, },);
        await writeFile(configPath, '{',);

        let caught: unknown;
        try {
          loadLinkupConfig({
            home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('pi-linkup.json',);
        expect((caught as Error).message,).toContain('parsing',);
        expect((caught as Error).message,).toContain(configPath,);
      },
    },),
    it({
      name: 'reports invalid blocklist entry with offending entry',
      fn: async () => {
        const home = await tempHome();
        await writeConfig({
          home,
          value: {
            blocklist: [INVALID_BLOCKLIST_ENTRY,],
          },
        },);

        let caught: unknown;
        try {
          loadLinkupConfig({
            home,
            env: {},
          },);
        }
        catch (error: unknown) {
          caught = error;
        }

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('pi-linkup.json',);
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
    'pi-linkup-config-test-',
  ),);
}

/**
 * Write Pi Linkup config under a temp home.
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
  const configPath = configPathForHome({ home, },);
  await mkdir(dirname(configPath,), { recursive: true, },);
  await writeFile(
    configPath,
    JSON.stringify(value,),
  );
}

//endregion Helpers
