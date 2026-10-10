/**
 Tests explicit provider requirements for validation and performance arms.

 The gate reads its keys and the Bedrock ledger's place from the environment
 it is handed and its meters over the transport it is handed, so every case
 hands over its own of both: no case reads the process's keys, reaches a
 provider, or opens the real spend ledger (ledger M43, M68).

 Fixtures are invented; the keys are placeholders no provider issued.

 @module
 */

import { join, } from 'node:path';

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import {
  caught,
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertRequiredProvidersReady,
  BEDROCK_CREDIT_USD_VAR,
  BEDROCK_LEDGER_PATH_VAR,
  HYPER_CREDITS_URL,
  fetchTransport,
  type ModelTransport,
  OPENROUTER_CREDITS_URL,
  readRequiredProviders,
  RequiredProviderError,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';
import { warnLinesDuring, } from '../console-warn-lines.test-fixture.ts';
import {
  answerEveryFetchWithRefusal,
  ECHOED_KEY,
  statusFailureLogText,
} from '../provider-status-failure.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { lineOf, } from './command-line.test-fixture.ts';
import { HANG_STOP_MS, } from '../hang-stop.test-fixture.ts';

/**
 Each provider's key environment name.
 */
const KEY_NAMES = {
  synthetic: 'TRANSLATION_REPAIR_SYNTHETIC_API_KEY',
  hyper: 'TRANSLATION_REPAIR_CHARM_HYPER_API_KEY',
  bedrock: 'TRANSLATION_REPAIR_AMAZON_BEDROCK_API_KEY',
  openrouter: 'TRANSLATION_REPAIR_OPENROUTER_API_KEY',
} as const;

/**
 Wet Synthetic meter response fixture.
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

/**
 Transport a case must never reach, since the gate refuses first or reads no
 meter over HTTP.

 @returns Never

 @throws Error always
 */
async function unreachedTransport(): ReturnType<ModelTransport> {
  throw new Error('the gate asked a meter this case never answers',);
}

/**
 What the gate refused with, or that it did not refuse.

 @param act - gate call

 @returns The refusal, or `'passed'`
 */
async function gateOutcome(act: () => Promise<void>,): Promise<unknown> {
  try {
    await act();
    return 'passed';
  }
  catch (error) {
    return error;
  }
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: readRequiredProviders.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS ORDERED DISTINCT PROVIDER REQUIREMENT, the third provider included',
          fn: async () => {
            expect(readRequiredProviders({
              line: lineOf({
                command: 'corpus-pass',
                typed: [
                  '--require-providers',
                  'synthetic,openrouter,hyper,synthetic',
                ],
              },),
            },),).toEqual([
              'synthetic',
              'openrouter',
              'hyper',
            ],);
          },
        },),
        it({
          name: 'REQUIRES NOTHING when the flag is absent, which is every ordinary run (ledger T8)',
          fn: async () => {
            expect(readRequiredProviders({
              line: lineOf({
                command: 'corpus-pass',
                typed: [],
              },),
            },),).toEqual([],);
          },
        },),
        it({
          name: 'REFUSES the flag with no value, an empty value, separators naming nobody or a provider nobody '
            + 'serves, naming what it accepts (ledger T8, B75)',
          fn: async () => {
            for (
              const typed of [
                ['--require-providers',],
                ['--require-providers', '',],
                ['--require-providers', ',',],
                ['--require-providers', 'synthetic,catnip',],
              ]
            ) {
              /**
               What the reader raised for these arguments.
               */
              const refusal = caught(function readFlag(): unknown {
                return readRequiredProviders({
                  line: lineOf({
                    command: 'corpus-pass',
                    typed,
                  },),
                },);
              },);
              expect(refusal,).toBeInstanceOf(StatedRefusalError,);
              expect((refusal as Error).message,).toContain('synthetic, bedrock, hyper, openrouter',);
            }
          },
        },),
        it({
          name: 'QUOTES the provider it refuses, so a spaced or mistyped name shows as typed (ledger B75)',
          fn: async () => {
            expect((caught(function readSpaced(): unknown {
              return readRequiredProviders({
                line: lineOf({
                  command: 'corpus-pass',
                  typed: ['--require-providers', 'synthetic,cat nip',],
                },),
              },);
            },) as Error).message,).toBe(
              '--require-providers accepts only synthetic, bedrock, hyper, openrouter, and "cat nip" is none of them',
            );
          },
        },),
      ],
    },),

    describe({
      name: assertRequiredProvidersReady.name,
      concurrency: 1,
      children: [
        it({
          name: 'ASKS NO METER when nothing is required (ledger T8)',
          fn: async () => {
            expect(await gateOutcome(async function gateNothing() {
              await assertRequiredProvidersReady({
                required: [],
                env: {},
                transport: unreachedTransport,
                signal: AbortSignal.timeout(HANG_STOP_MS,),
              },);
            },),).toBe('passed',);
          },
        },),
        it({
          name: 'REFUSES MISSING REQUIRED KEY before transport call',
          fn: async () => {
            /**
             What the gate raised for a requirement whose key is unset.
             */
            const refusal = await gateOutcome(async function gateKeyless() {
              await assertRequiredProvidersReady({
                required: ['synthetic', 'hyper',],
                env: { [KEY_NAMES.hyper]: 'test-hyper', },
                transport: unreachedTransport,
                signal: AbortSignal.timeout(HANG_STOP_MS,),
              },);
            },);
            expect(refusal,).toBeInstanceOf(RequiredProviderError,);
            expect((refusal as Error).message,).toContain('synthetic is not ready: key missing',);
          },
        },),
        it({
          name: 'ACCEPTS EVERY WET METER without model endpoint call, OpenRouter\'s credits included',
          fn: async () => {
            const urls: string[] = [];
            await assertRequiredProvidersReady({
              required: ['synthetic', 'hyper', 'openrouter',],
              env: {
                [KEY_NAMES.synthetic]: 'test-synthetic',
                [KEY_NAMES.hyper]: 'test-hyper',
                [KEY_NAMES.openrouter]: 'test-openrouter',
              },
              transport: async function transport(exchange,) {
                urls.push(exchange.url,);
                if (exchange.url === HYPER_CREDITS_URL)
                  return { status: 200, bodyText: '{"balance":243}', };
                if (exchange.url === OPENROUTER_CREDITS_URL)
                  return { status: 200, bodyText: '{"data":{"total_credits":1913,"total_usage":1855.38}}', };
                return { status: 200, bodyText: WET_SYNTHETIC_BODY, };
              },
              signal: AbortSignal.timeout(HANG_STOP_MS,),
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
            /**
             What the gate raised over a spent OpenRouter balance.
             */
            const refusal = await gateOutcome(async function gateDry() {
              await assertRequiredProvidersReady({
                required: ['openrouter',],
                env: { [KEY_NAMES.openrouter]: 'test-openrouter', },
                transport: async function transport() {
                  return { status: 200, bodyText: '{"data":{"total_credits":10,"total_usage":10}}', };
                },
                signal: AbortSignal.timeout(HANG_STOP_MS,),
              },);
            },);
            expect(refusal,).toBeInstanceOf(RequiredProviderError,);
            expect((refusal as Error).message,).toContain('openrouter is not ready: budget dry',);
          },
        },),
        it({
          name: 'REFUSES NAMING THE FIRST REQUIRED PROVIDER when two meters cannot be read and the later one '
            + 'is refused first',
          fn: async () => {
            /**
             Opened when the second provider's meter has been asked, which the
             first provider's answer waits for.
             */
            const laterAsked = Promise.withResolvers<undefined>();
            /**
             What the gate raised over two meters that refuse the key.
             */
            const refusal = await gateOutcome(async function gateBothUnreadable() {
              await assertRequiredProvidersReady({
                required: ['synthetic', 'hyper',],
                env: {
                  [KEY_NAMES.synthetic]: 'test-synthetic',
                  [KEY_NAMES.hyper]: 'test-hyper',
                },
                transport: async function refusesHyperFirst(exchange,) {
                  if (exchange.url === HYPER_CREDITS_URL) {
                    laterAsked.resolve(undefined,);
                    return { status: 401, bodyText: 'no such cat', };
                  }
                  await laterAsked.promise;
                  // A turn of the event loop, after which every continuation the
                  // later provider's refusal needed has run.
                  await wait(0,);
                  return { status: 401, bodyText: 'no such cat', };
                },
                signal: AbortSignal.timeout(HANG_STOP_MS,),
              },);
            },);
            expect(refusal,).toBeInstanceOf(RequiredProviderError,);
            expect((refusal as Error).message,).toContain('synthetic is not ready: meter unavailable',);
          },
        },),
        it({
          name: 'REFUSES A METER THAT CANNOT BE READ as unavailable rather than wet, whatever the transport did '
            + '(ledger T8)',
          fn: async () => {
            /**
             What the gate raised when the Hyper meter refused the key, a status
             the client does not retry.
             */
            const refusal = await gateOutcome(async function gateUnreadable() {
              await assertRequiredProvidersReady({
                required: ['hyper',],
                env: { [KEY_NAMES.hyper]: 'test-hyper', },
                transport: async function transport() {
                  return { status: 401, bodyText: 'no such cat', };
                },
                signal: AbortSignal.timeout(HANG_STOP_MS,),
              },);
            },);
            expect(refusal,).toBeInstanceOf(RequiredProviderError,);
            expect((refusal as Error).message,).toContain('hyper is not ready: meter unavailable',);
          },
        },),
        it({
          name: 'WARNS WHICH METER COULD NOT BE READ, with the provider\'s status and its words and never the key '
            + 'its refusal echoed, when the meter answers over the real transport',
          fn: async ctx => {
            answerEveryFetchWithRefusal({
              sinon: ctx.sinon,
              status: 401,
            },);

            const { result, warned, } = await warnLinesDuring({
              run: async function gateOverRefusingMeter(): Promise<unknown> {
                return gateOutcome(async function gateRefused() {
                  await assertRequiredProvidersReady({
                    required: ['hyper',],
                    env: { [KEY_NAMES.hyper]: ECHOED_KEY, },
                    transport: fetchTransport,
                    signal: AbortSignal.timeout(HANG_STOP_MS,),
                  },);
                },);
              },
            },);

            expect(result,).toBeInstanceOf(RequiredProviderError,);
            expect(warned,).toEqual([
              `[gateProvider] hyper meter could not be read: ${statusFailureLogText({ status: 401, },)}`,
            ],);
          },
        },),
        it({
          name: 'READS BEDROCK OFF THE LEDGER THE HANDED ENVIRONMENT NAMES, over no HTTP, wet under its credit and dry '
            + 'at none (ledger T8)',
          fn: async () => {
            /**
             Directory holding this case's empty ledger.
             */
            await using scratch = await scratchDir({ prefix: 'required-providers-ledger-', },);
            const dir = scratch.path;
            /**
             Gate over Bedrock with one credit override.

             @param creditUsd - credit the environment grants

             @returns What the gate did
             */
            async function gateBedrock(creditUsd: string,): Promise<unknown> {
              return await gateOutcome(async function gateLedger() {
                await assertRequiredProvidersReady({
                  required: ['bedrock',],
                  env: {
                    [KEY_NAMES.bedrock]: 'test-bedrock',
                    [BEDROCK_LEDGER_PATH_VAR]: join(dir, 'bedrock-spend.jsonl',),
                    [BEDROCK_CREDIT_USD_VAR]: creditUsd,
                  },
                  transport: unreachedTransport,
                  signal: AbortSignal.timeout(HANG_STOP_MS,),
                },);
              },);
            }
            expect(await gateBedrock('40',),).toBe('passed',);
            /**
             What the gate raised with no credit to spend.
             */
            const refusal = await gateBedrock('0',);
            expect(refusal,).toBeInstanceOf(RequiredProviderError,);
            expect((refusal as Error).message,).toContain('bedrock is not ready: budget dry',);
          },
        },),
      ],
    },),
  ],
},);
