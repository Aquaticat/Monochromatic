/**
 * Tests explicit provider requirements for validation and performance arms.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertRequiredProvidersReady,
  HYPER_CREDITS_URL,
  OPENROUTER_CREDITS_URL,
  readRequiredProviders,
  RequiredProviderError,
} from '../../dist/final/node/index.mjs';

/**
 * Each provider's key environment name.
 */
const KEY_NAMES = {
  synthetic: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY',
  hyper: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY',
  openrouter: 'TRANSLATION_REPAIR_OPENROUTER_API_KEY',
} as const;

/**
 * Installs provider keys for scope and restores prior environment.
 *
 * @param keys - key value per provider, absent to unset
 *
 * @returns Disposable restoring every variable
 *
 * @example
 * ```ts
 * using _keys = withProviderKeys({ synthetic: 'test', hyper: 'test', });
 * ```
 */
function withProviderKeys(
  keys: {
    readonly synthetic?: string;
    readonly hyper?: string;
    readonly openrouter?: string;
  },
): Disposable {
  /**
   * What each variable held before, absent from the map where it was unset.
   */
  const prior = new Map<string, string>();
  for (const name of Object.values(KEY_NAMES,)) {
    /**
     * Value the variable holds now, if any.
     */
    const held = process.env[name];
    if (held !== undefined)
      prior.set(
        name,
        held,
      );
  }
  /**
   * Values to install, keyed by variable name.
   */
  const wanted = new Map<string, string>();
  if (keys.synthetic !== undefined)
    wanted.set(
      KEY_NAMES.synthetic,
      keys.synthetic,
    );
  if (keys.hyper !== undefined)
    wanted.set(
      KEY_NAMES.hyper,
      keys.hyper,
    );
  if (keys.openrouter !== undefined)
    wanted.set(
      KEY_NAMES.openrouter,
      keys.openrouter,
    );
  for (const name of Object.values(KEY_NAMES,)) {
    if (wanted.has(name,))
      process.env[name] = wanted.get(name,);
    else
      Reflect.deleteProperty(process.env, name,);
  }
  return {
    [Symbol.dispose](): void {
      for (const name of Object.values(KEY_NAMES,)) {
        if (prior.has(name,))
          process.env[name] = prior.get(name,);
        else
          Reflect.deleteProperty(process.env, name,);
      }
    },
  };
}

/**
 * Wet Synthetic meter response fixture.
 */
const WET_SYNTHETIC_BODY = JSON.stringify({
  weeklyTokenLimit: {
    nextRegenAt: '2026-08-30T00:00:00.000Z',
    percentRemaining: 75,
  },
  rollingFiveHourLimit: {
    nextTickAt: '2026-08-29T15:00:00.000Z',
    tickPercent: 0.05,
    remaining: 500,
    max: 750,
    limited: false,
  },
},);

await describe({
  name: readRequiredProviders.name,
  children: [
    it({
      name: 'READS ORDERED DISTINCT PROVIDER REQUIREMENT, the third provider included',
      fn: async () => {
        expect(readRequiredProviders({
          argv: [
            'node',
            'corpus-pass',
            '--require-providers',
            'synthetic,openrouter,hyper,synthetic',
          ],
        },),).toEqual([
          'synthetic',
          'openrouter',
          'hyper',
        ],);
      },
    },),
  ],
},);

await describe({
  name: assertRequiredProvidersReady.name,
  concurrency: 1,
  children: [
    it({
      name: 'REFUSES MISSING REQUIRED KEY before transport call',
      fn: async () => {
        using _keys = withProviderKeys({ hyper: 'test-hyper', },);
        let transportCalls = 0;
        let caught: unknown;
        try {
          await assertRequiredProvidersReady({
            required: ['synthetic', 'hyper',],
            transport: async function transport() {
              transportCalls += 1;
              return { status: 500, bodyText: '', };
            },
            signal: AbortSignal.timeout(5_000,),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(RequiredProviderError,);
        expect(transportCalls,).toBe(0,);
      },
    },),

    it({
      name: 'ACCEPTS EVERY WET METER without model endpoint call, OpenRouter\'s credits included',
      fn: async () => {
        using _keys = withProviderKeys({
          synthetic: 'test-synthetic',
          hyper: 'test-hyper',
          openrouter: 'test-openrouter',
        },);
        const urls: string[] = [];
        await assertRequiredProvidersReady({
          required: ['synthetic', 'hyper', 'openrouter',],
          transport: async function transport(exchange,) {
            urls.push(exchange.url,);
            if (exchange.url === HYPER_CREDITS_URL)
              return { status: 200, bodyText: '{"balance":243}', };
            if (exchange.url === OPENROUTER_CREDITS_URL)
              return { status: 200, bodyText: '{"data":{"total_credits":1913,"total_usage":1855.38}}', };
            return { status: 200, bodyText: WET_SYNTHETIC_BODY, };
          },
          signal: AbortSignal.timeout(5_000,),
        },);
        expect(urls,).toHaveLength(3,);
        expect(urls,).toContain(HYPER_CREDITS_URL,);
        expect(urls,).toContain(OPENROUTER_CREDITS_URL,);
        expect(urls.some(function modelEndpoint(url,): boolean {
          return url.includes('/chat/',);
        },),).toBe(false,);
      },
    },),

    it({
      name: 'REFUSES A DRY REQUIRED METER, naming the provider, so a measured arm never starts on a '
        + 'provider that cannot serve it',
      fn: async () => {
        using _keys = withProviderKeys({ openrouter: 'test-openrouter', },);
        let caught: unknown;
        try {
          await assertRequiredProvidersReady({
            required: ['openrouter',],
            transport: async function transport() {
              return { status: 200, bodyText: '{"data":{"total_credits":10,"total_usage":10}}', };
            },
            signal: AbortSignal.timeout(5_000,),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(RequiredProviderError,);
        expect((caught as Error).message,).toContain('openrouter is not ready: budget dry',);
      },
    },),
  ],
},);
