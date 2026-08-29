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
  readRequiredProviders,
  RequiredProviderError,
} from '../../dist/final/node/index.mjs';

/**
 * Synthetic key environment name.
 */
const SYNTHETIC_KEY = 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY';

/**
 * Hyper key environment name.
 */
const HYPER_KEY = 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY';

/**
 * Installs provider keys for scope and restores prior environment.
 *
 * @param synthetic - synthetic key value
 *
 * @param hyper - hyper key value
 *
 * @returns Disposable restoring both variables
 *
 * @example
 * ```ts
 * using _keys = withProviderKeys({ synthetic: 'test', hyper: 'test', });
 * ```
 */
function withProviderKeys(
  {
    synthetic,
    hyper,
  }: {
    readonly synthetic?: string;
    readonly hyper?: string;
  },
): Disposable {
  const priorSynthetic = process.env[SYNTHETIC_KEY];
  const priorHyper = process.env[HYPER_KEY];
  if (synthetic === undefined)
    Reflect.deleteProperty(process.env, SYNTHETIC_KEY,);
  else
    process.env[SYNTHETIC_KEY] = synthetic;
  if (hyper === undefined)
    Reflect.deleteProperty(process.env, HYPER_KEY,);
  else
    process.env[HYPER_KEY] = hyper;
  return {
    [Symbol.dispose](): void {
      if (priorSynthetic === undefined)
        Reflect.deleteProperty(process.env, SYNTHETIC_KEY,);
      else
        process.env[SYNTHETIC_KEY] = priorSynthetic;
      if (priorHyper === undefined)
        Reflect.deleteProperty(process.env, HYPER_KEY,);
      else
        process.env[HYPER_KEY] = priorHyper;
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
      name: 'READS ORDERED DISTINCT PROVIDER REQUIREMENT',
      fn: async () => {
        expect(readRequiredProviders({
          argv: [
            'node',
            'corpus-pass',
            '--require-providers',
            'synthetic,hyper,synthetic',
          ],
        },),).toEqual([
          'synthetic',
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
      name: 'ACCEPTS BOTH WET METERS without model endpoint call',
      fn: async () => {
        using _keys = withProviderKeys({
          synthetic: 'test-synthetic',
          hyper: 'test-hyper',
        },);
        const urls: string[] = [];
        await assertRequiredProvidersReady({
          required: ['synthetic', 'hyper',],
          transport: async function transport(exchange,) {
            urls.push(exchange.url,);
            return exchange.url === HYPER_CREDITS_URL
              ? { status: 200, bodyText: '{"balance":243}', }
              : { status: 200, bodyText: WET_SYNTHETIC_BODY, };
          },
          signal: AbortSignal.timeout(5_000,),
        },);
        expect(urls,).toHaveLength(2,);
        expect(urls,).toContain(HYPER_CREDITS_URL,);
        expect(urls.some(function modelEndpoint(url,): boolean {
          return url.includes('/chat/',);
        },),).toBe(false,);
      },
    },),
  ],
},);
