/**
 Tests the run client with NeuralWatt configured: the key that switches the
 provider on, the first place it takes in the order, the day's allowance and
 ledger the environment names, and the start guard's view of it.

 The owner, 2026-10-20: "Use the neuralwatt free energy front and center."

 Every case hands over its own environment and a scripted transport, and its
 own ledger in a throwaway directory, so none reads a key the suite inherits,
 reaches NeuralWatt, or opens the real energy ledger.

 @module
 */

import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { NoProviderForModelError, } from '@monochromatic-dev/translation-repair-markup';
import {
  NEURALWATT_DAILY_WH_VAR,
  NEURALWATT_LEDGER_PATH_VAR,
} from '@monochromatic-dev/translation-repair-provider';
import type { TransportExchange, } from '@monochromatic-dev/translation-repair-provider-stream';
import {
  EveryProviderDryError,
  runClientFrom,
  RunConfigError,
  runEndReports,
} from '../../dist/final/node/index.mjs';
import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/rejecting-call.test-fixture.ts';
import {
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';
import { scratchDir, } from '@monochromatic-dev/translation-repair-test-fixture/ts/scratch-dir.test-fixture.ts';

/**
 Name of the NeuralWatt key variable, named only.
 */
const NEURALWATT_KEY_VAR = 'TRANSLATION_REPAIR_NEURALWATT_API_KEY';

/**
 Stream NeuralWatt answers a chat call with: one content chunk, usage, the
 two documented comment lines, done.
 */
const NEURALWATT_STREAM = [
  `data: ${JSON.stringify({
    id: 'chatcmpl-nap',
    choices: [{ index: 0, delta: { role: 'assistant', content: 'sunbeam', }, finish_reason: null, },],
  },)}\n\n`,
  `data: ${JSON.stringify({ id: 'chatcmpl-nap', choices: [], usage: { prompt_tokens: 90, completion_tokens: 10, total_tokens: 100, }, },)}\n\n`,
  ': energy {"energy_kwh": 0.0000005}\n\n',
  ': cost {"request_cost_usd": 0}\n\n',
  'data: [DONE]\n\n',
].join('',);

/**
 Quota reply of an account with a plan.
 */
const QUOTA_BODY = JSON.stringify({
  snapshot_at: '2026-10-20T20:00:00Z',
  subscription: { plan: 'max', current_period_start: '2026-10-11T05:05:25Z', kwh_used: 13.9, kwh_remaining: 6.1, in_overage: false, },
},);

/**
 Transport answering NeuralWatt's two routes, recording what it was asked.

 @param exchanges - where each exchange is recorded

 @returns Transport for a run client

 @example
 ```ts
 const transport = scriptedNeuralWatt({ exchanges: [], },);
 ```
 */
function scriptedNeuralWatt(
  { exchanges, }: { readonly exchanges: TransportExchange[]; },
) {
  return async function answer(exchange: TransportExchange,) {
    exchanges.push(exchange,);
    return (exchange.method === 'GET')
      ? { status: 200, bodyText: QUOTA_BODY, }
      : { status: 200, bodyText: NEURALWATT_STREAM, };
  };
}

await describe({
  name: 'run client with NeuralWatt',
  concurrency: 1,
  children: [
    it({
      name: 'BUILDS ON THE NEURALWATT KEY ALONE, and sends a DeepSeek V4.1 Flash call to it first',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'run-client-neuralwatt-', },);
        const exchanges: TransportExchange[] = [];
        const client = runClientFrom({
          env: {
            [NEURALWATT_KEY_VAR]: 'tabby-not-a-real-key',
            [NEURALWATT_LEDGER_PATH_VAR]: join(scratch.path, 'neuralwatt-energy.jsonl',),
          },
          transport: scriptedNeuralWatt({ exchanges, },),
        },);
        /**
         Reply the routed call settled on.
         */
        const reply = await client.chatText({
          modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
          messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
          signal: new AbortController().signal,
        },);
        expect(reply.text,).toBe('sunbeam',);
        expect(exchanges.map(function urlOf(exchange,): string {
          return `${exchange.method} ${exchange.url}`;
        },),).toEqual([
          'GET https://api.neuralwatt.com/v1/quota',
          'POST https://api.neuralwatt.com/v1/chat/completions',
        ],);
        expect(await client.providerDryness({ signal: new AbortController().signal, },),).toEqual({
          neuralwatt: false,
          synthetic: true,
          bedrock: true,
          hyper: true,
          openrouter: true,
        },);
      },
    },),

    it({
      name: 'READS NEURALWATT DRY WHEN THE ENVIRONMENT GRANTS NO ENERGY, as on a day with no promo, and ends the call '
        + 'for a model nobody else serves without a request',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'run-client-neuralwatt-', },);
        const exchanges: TransportExchange[] = [];
        const client = runClientFrom({
          env: {
            [NEURALWATT_KEY_VAR]: 'tabby-not-a-real-key',
            [NEURALWATT_LEDGER_PATH_VAR]: join(scratch.path, 'neuralwatt-energy.jsonl',),
            [NEURALWATT_DAILY_WH_VAR]: '0',
          },
          transport: scriptedNeuralWatt({ exchanges, },),
        },);
        expect((await client.providerDryness({ signal: new AbortController().signal, },)).neuralwatt,).toBe(true,);
        /**
         What the call ended with.
         */
        const refusal = await rejectionOf(async function ask(): Promise<void> {
          await client.chatText({
            modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
            messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
            signal: new AbortController().signal,
          },);
        },);
        expect(refusal,).toBeInstanceOf(EveryProviderDryError,);
        expect(exchanges.length,).toBe(0,);
      },
    },),

    it({
      name: 'NEVER ROUTES A MODEL NEURALWATT DOES NOT SERVE TO IT: the same key refuses a Synthetic-only seat as '
        + 'unreachable',
      fn: async () => {
        await using scratch = await scratchDir({ prefix: 'run-client-neuralwatt-', },);
        const exchanges: TransportExchange[] = [];
        const client = runClientFrom({
          env: {
            [NEURALWATT_KEY_VAR]: 'tabby-not-a-real-key',
            [NEURALWATT_LEDGER_PATH_VAR]: join(scratch.path, 'neuralwatt-energy.jsonl',),
          },
          transport: scriptedNeuralWatt({ exchanges, },),
        },);
        expect(await rejectionOf(async function ask(): Promise<void> {
          await client.chatText({
            modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
            messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
            signal: new AbortController().signal,
          },);
        },),).toBeInstanceOf(NoProviderForModelError,);
        expect(exchanges.length,).toBe(0,);
      },
    },),

    it({
      name: 'REGISTERS THE END-OF-RUN QUOTA REPORT when the key is set, and says the run made no NeuralWatt call '
        + 'when none was made, reading no quota',
      fn: async () => {
        await runEndReports();
        await using scratch = await scratchDir({ prefix: 'run-client-neuralwatt-', },);
        const exchanges: TransportExchange[] = [];
        runClientFrom({
          env: {
            [NEURALWATT_KEY_VAR]: 'tabby-not-a-real-key',
            [NEURALWATT_LEDGER_PATH_VAR]: join(scratch.path, 'neuralwatt-energy.jsonl',),
          },
          transport: scriptedNeuralWatt({ exchanges, },),
        },);
        /**
         The lines the run's end prints.
         */
        const lines = await runEndReports();
        expect(lines.length,).toBe(1,);
        expect(lines[0],).toContain('NeuralWatt',);
        expect(lines[0],).toContain('no NeuralWatt call',);
        expect(exchanges.length,).toBe(0,);
      },
    },),

    it({
      name: 'NAMES THE NEURALWATT KEY AMONG THE VARIABLES A RUN CANNOT START WITHOUT, when no key at all is set',
      fn: async () => {
        /**
         What building with no key raised.
         */
        const refusal = await rejectionOf(async function build(): Promise<void> {
          runClientFrom({
            env: {},
            transport: async function unasked() {
              throw new Error('a case that only builds a client asked a provider',);
            },
          },);
        },);
        expect(refusal,).toBeInstanceOf(RunConfigError,);
        expect(String(refusal,),).toContain(NEURALWATT_KEY_VAR,);
      },
    },),
  ],
},);
