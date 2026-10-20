import { join, } from 'node:path';

import {
  createNeuralWattClient,
  createNeuralWattLedger,
  type NeuralWattClient,
} from '../dist/final/node/index.mjs';
import type {
  TransportExchange,
  TransportReply,
} from '@monochromatic-dev/translation-repair-provider-stream';
import { handClock, } from './neuralwatt-ledger.test-fixture.ts';
import { SEAT_HYPER_OPENROUTER_UNMEASURED, } from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';

//region NeuralWatt scripted client test support
// A NEURALWATT CLIENT OVER A SCRIPTED TRANSPORT AND A LEDGER FILE IN A CASE'S OWN DIRECTORY, for the cases about the
// modules that sit behind the client: the quota session and the settlement. Neither is on the package index, so the
// cases reach them the way production does, through a call.
//
// TEST SUPPORT, NOT PACKAGE SOURCE: no case calls NeuralWatt or reads a key, the clock is the case's own, and the
// stream shape is the one the documentation prints (`https://docs.neuralwatt.com/energy-methodology.md`, fetched
// 2026-10-20).

/**
 Host every case points the client at; no case reaches it.
 */
export const BASE_URL = 'https://neuralwatt.invalid/v1';

/**
 Abort signal every call here carries.
 */
export const SIGNAL: AbortSignal = new AbortController().signal;

/**
 The energy comment the page prints: 0.000015 kWh, which is 0.015 Wh.
 */
export const ENERGY_COMMENT = ': energy {"energy_kwh": 0.000015, "energy_joules": 54.0, "attribution_ratio": 0.25}\n\n';

/**
 The cost comment of a free request.
 */
export const FREE_COST_COMMENT = ': cost {"request_cost_usd": 0, "cache_savings_usd": 0.0}\n\n';

/**
 The cost comment of a free-energy request that carries a nominal cost above zero, as the first keyed run's did
 (0.000107 USD for a request the dashboard counted wholly against the free energy).
 */
export const NOMINAL_COST_COMMENT = ': cost {"request_cost_usd": 0.00001}\n\n';

/**
 kWh the plan in every quota reply here includes.
 */
const QUOTA_INCLUDED_KWH = 20;

/**
 Reply a transport gives where the script has run out, which no case means to reach.
 */
const NO_SCRIPT_REPLY: TransportReply = {
  status: 500,
  bodyText: 'no script',
};

/**
 Quota reply of an account with no subscription, the field present and null.
 */
export const NO_SUBSCRIPTION_REPLY: TransportReply = {
  status: 200,
  bodyText: JSON.stringify({
    snapshot_at: '2026-10-20T20:00:00Z',
    subscription: null,
  },),
};

/**
 Quota reply whose subscription leaves the charged figure out, as null.
 */
export const UNREPORTED_QUOTA_REPLY: TransportReply = {
  status: 200,
  bodyText: JSON.stringify({
    snapshot_at: '2026-10-20T20:00:00Z',
    subscription: {
      plan: 'max',
      current_period_start: '2026-10-11T05:05:25Z',
      kwh_included: 20,
      kwh_used: null,
      kwh_remaining: 20,
      in_overage: false,
    },
  },),
};

/**
 Whole stream an endpoint answers with.

 @param comments - comment lines placed before the sentinel, each ending in a blank line

 @param done - whether the sentinel closes the stream

 @returns Body text

 @example
 ```ts
 const bodyText = streamOf({ comments: ENERGY_COMMENT, },);
 ```
 */
export function streamOf(
  {
    comments = '',
    done = true,
  }: {
    readonly comments?: string;
    readonly done?: boolean;
  },
): string {
  return [
    `data: ${JSON.stringify({
      id: 'chatcmpl-whiskers',
      object: 'chat.completion.chunk',
      choices: [{
        index: 0,
        delta: {
          role: 'assistant',
          content: '{"spot":"sunbeam"}',
        },
        finish_reason: null,
      },],
    },)}\n\n`,
    `data: ${JSON.stringify({
      id: 'chatcmpl-whiskers',
      object: 'chat.completion.chunk',
      choices: [],
      usage: {
        prompt_tokens: 90,
        completion_tokens: 10,
        total_tokens: 100,
      },
    },)}\n\n`,
    comments,
    done ? 'data: [DONE]\n\n' : '',
  ].join('',);
}

/**
 Quota reply with a given charged energy.

 @param kwhUsed - charged kWh this period

 @param periodStart - start of the billing period the reading belongs to

 @returns Success reply

 @example
 ```ts
 const reply = quotaReply({ kwhUsed: 13.9, },);
 ```
 */
export function quotaReply(
  {
    kwhUsed,
    periodStart = '2026-10-11T05:05:25Z',
  }: {
    readonly kwhUsed: number;
    readonly periodStart?: string;
  },
): TransportReply {
  return {
    status: 200,
    bodyText: JSON.stringify({
      snapshot_at: '2026-10-20T20:00:00Z',
      subscription: {
        plan: 'max',
        current_period_start: periodStart,
        kwh_included: QUOTA_INCLUDED_KWH,
        kwh_used: kwhUsed,
        kwh_remaining: QUOTA_INCLUDED_KWH - kwhUsed,
        in_overage: false,
      },
    },),
  };
}

/**
 Builds a client over a scripted transport and a ledger file in a given
 directory.

 @param dir - directory the ledger file lives in

 @param dailyWh - the day's allowance

 @param chat - replies to chat completions, in order, the last repeating

 @param quota - replies to quota reads, in order, the last repeating; an error stands for a read the connection dropped

 @returns Client, ledger, and what the transport saw

 @example
 ```ts
 const { client, ledger, } = scriptedClient({ dir, },);
 ```
 */
export function scriptedClient(
  {
    dir,
    dailyWh = 550,
    chat = [{
      status: 200,
      bodyText: streamOf({ comments: ENERGY_COMMENT + FREE_COST_COMMENT, }),
    },],
    quota = [quotaReply({ kwhUsed: 13.9023, }),],
  }: {
    readonly dir: string;
    readonly dailyWh?: number;
    readonly chat?: readonly TransportReply[];
    readonly quota?: readonly (Error | TransportReply)[];
  },
): {
  readonly client: NeuralWattClient;
  readonly ledger: ReturnType<typeof createNeuralWattLedger>;
  readonly exchanges: readonly TransportExchange[];
} {
  /**
   Every exchange the transport was handed.
   */
  const exchanges: TransportExchange[] = [];

  /**
   Exchanges of each kind seen so far, for scripting by position.
   */
  const counts = {
    chat: 0,
    quota: 0,
  };

  /**
   Clock the ledger reads, which no case moves.
   */
  const clock = handClock({ start: '2026-10-20T12:00:00.000Z', },);

  /**
   Ledger the client spends against, on a clock the case does not move.
   */
  const ledger = createNeuralWattLedger({
    path: join(
      dir,
      'neuralwatt-energy.jsonl',
    ),
    dailyWh,
    now: clock.now,
  },);
  return {
    exchanges,
    ledger,
    client: createNeuralWattClient({
      apiKey: 'test-key',
      ledger,
      baseUrl: BASE_URL,
      transport: function transport(exchange,): Promise<TransportReply> {
        exchanges.push(exchange,);
        if (exchange.method === 'GET') {
          counts.quota += 1;

          /**
           What this quota read is scripted to get.
           */
          const scripted = quota[Math.min(
            counts.quota - 1,
            quota.length - 1,
          )] ?? NO_SCRIPT_REPLY;
          return Error.isError(scripted,) ? Promise.reject(scripted,) : Promise.resolve(scripted,);
        }
        counts.chat += 1;
        return Promise.resolve(
          chat[Math.min(
            counts.chat - 1,
            chat.length - 1,
          )] ?? NO_SCRIPT_REPLY,
        );
      },
      retryPolicy: {
        limit: 0,
        baseMs: 1,
      },
    },),
  };
}

/**
 Chat exchanges among those seen.

 @param exchanges - everything the transport saw

 @returns The POSTs

 @example
 ```ts
 const posts = chatExchangesOf({ exchanges, },);
 ```
 */
export function chatExchangesOf(
  { exchanges, }: { readonly exchanges: readonly TransportExchange[]; },
): readonly TransportExchange[] {
  return exchanges.filter(function isPost(exchange,): boolean {
    return exchange.method === 'POST';
  },);
}

/**
 Quota exchanges among those seen.

 @param exchanges - everything the transport saw

 @returns The GETs

 @example
 ```ts
 const reads = quotaExchangesOf({ exchanges, },);
 ```
 */
export function quotaExchangesOf(
  { exchanges, }: { readonly exchanges: readonly TransportExchange[]; },
): readonly TransportExchange[] {
  return exchanges.filter(function isGet(exchange,): boolean {
    return exchange.method === 'GET';
  },);
}

/**
 Asks the DeepSeek seat one short question.

 @param client - client under test

 @returns The reply

 @example
 ```ts
 const reply = await ask({ client, },);
 ```
 */
export async function ask(
  { client, }: { readonly client: NeuralWattClient; },
): ReturnType<NeuralWattClient['chatText']> {
  return await client.chatText({
    modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
    messages: [{
      role: 'user',
      content: 'Where does the cat sleep?',
    },],
    signal: SIGNAL,
  },);
}

//endregion NeuralWatt scripted client test support
