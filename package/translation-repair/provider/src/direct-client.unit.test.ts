/**
 Tests for the DeepSeek and Xiaomi clients over recorded transports.

 NOTHING HERE REACHES A PROVIDER: every transport is an in-memory script, and
 every key is invented. The stream shapes follow what the owner's grants of
 2026-10-22 were probed with: content chunks, `:` comment lines, a
 `reasoning_content` delta the reader drops, a usage chunk with DeepSeek's
 cache fields, and `[DONE]`. Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { rejectionOf, } from '@monochromatic-dev/translation-repair-test-fixture/ts/rejecting-call.test-fixture.ts';
import {
  ProviderHttpError,
  type ModelTransport,
  type TransportExchange,
  type TransportReply,
} from '@monochromatic-dev/translation-repair-provider-stream';
import { runSpendUsd, } from '@monochromatic-dev/translation-repair-shared-contract';
import {
  createDeepSeekClient,
  createXiaomiClient,
  DeepSeekBalanceShapeError,
  DeepSeekModelNotServedError,
  isPaymentRefusal,
  XiaomiModelNotServedError,
} from '../dist/final/node/index.mjs';
import {
  SEAT_HYPER_OPENROUTER_UNMEASURED,
  SEAT_OPENROUTER_ONLY_CHECKER,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
} from '@monochromatic-dev/translation-repair-test-fixture/ts/roster-seats.test-fixture.ts';

/**
 One chat completion chunk as the endpoint sends it.

 @param delta - delta fields for the single choice

 @returns Event line, newline-terminated

 @example
 ```ts
 const raw = chunkOf({ delta: { content: '{"spot":', }, },);
 ```
 */
function chunkOf({ delta, }: { readonly delta: Readonly<Record<string, unknown>>; },): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-6f1d0c4e',
    object: 'chat.completion.chunk',
    created: 1_788_811_674,
    system_fingerprint: 'fp_cat_build_7',
    choices: [{ index: 0, delta, finish_reason: null, },],
  },)}\n\n`;
}

/**
 Usage chunk with DeepSeek's cache fields: 40 of 100 prompt tokens hit.
 */
const DEEPSEEK_USAGE_CHUNK = `data: ${JSON.stringify({
  id: 'chatcmpl-6f1d0c4e',
  object: 'chat.completion.chunk',
  system_fingerprint: 'fp_cat_build_7',
  choices: [],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 10,
    total_tokens: 110,
    prompt_cache_hit_tokens: 40,
    prompt_cache_miss_tokens: 60,
  },
},)}\n\n`;

/**
 Usage chunk with the cached count Xiaomi reports: 50 of 100 prompt tokens.
 */
const XIAOMI_USAGE_CHUNK = `data: ${JSON.stringify({
  id: 'chatcmpl-9b2a7710',
  object: 'chat.completion.chunk',
  choices: [],
  usage: {
    prompt_tokens: 100,
    completion_tokens: 10,
    total_tokens: 110,
    prompt_tokens_details: { cached_tokens: 50, },
  },
},)}\n\n`;

/**
 Body of a whole stream, comment lines and reasoning included.

 @param usageChunk - the closing usage chunk

 @param done - whether the stream ends on its `[DONE]` sentinel

 @returns Stream text

 @example
 ```ts
 const body = streamOf({ usageChunk: DEEPSEEK_USAGE_CHUNK, done: true, },);
 ```
 */
function streamOf({ usageChunk, done, }: { readonly usageChunk: string; readonly done: boolean; },): string {
  return [
    ': keep-alive\n\n',
    chunkOf({ delta: { role: 'assistant', content: '', reasoning_content: 'The cat is thinking of naps.', }, },),
    chunkOf({ delta: { content: '{"spot":', }, },),
    ': keep-alive\n\n',
    chunkOf({ delta: { content: '"sunbeam"}', }, },),
    usageChunk,
    done ? 'data: [DONE]\n\n' : '',
  ].join('',);
}

/**
 Abort signal every call here carries.
 */
const SIGNAL = new AbortController().signal;

/**
 Retry pacing the cases use: one retry after a millisecond.
 */
const ONE_QUICK_RETRY = { limit: 1, baseMs: 1, } as const;

/**
 Response schema a stage would hand over.
 */
const NAP_SCHEMA = {
  type: 'json_schema',
  json_schema: {
    name: 'nap_spot',
    strict: true,
    schema: {
      type: 'object',
      required: ['spot',],
      properties: { spot: { type: 'string', }, },
    },
  },
} as const;

/**
 Transport answering from a script, recording what it was sent.

 @param replies - replies in order; the last repeats

 @returns Transport and the exchanges it saw

 @example
 ```ts
 const { transport, exchanges, } = scripted({ replies: [{ status: 200, bodyText: '', },], },);
 ```
 */
function scripted(
  { replies, }: { readonly replies: readonly { readonly status: number; readonly bodyText: string; }[]; },
): { readonly exchanges: TransportExchange[]; readonly transport: ModelTransport; } {
  /**
   Every exchange the transport was handed.
   */
  const exchanges: TransportExchange[] = [];
  return {
    exchanges,
    transport: async function transport(exchange: TransportExchange,): Promise<TransportReply> {
      exchanges.push(exchange,);
      const reply = replies[Math.min(exchanges.length - 1, replies.length - 1,)];
      if (reply === undefined)
        throw new Error('the script holds no reply',);
      return reply;
    },
  };
}

/**
 Body of the first exchange, parsed.

 @param exchanges - what the transport saw

 @returns The JSON body of the first exchange

 @example
 ```ts
 const body = firstBodyOf({ exchanges, },);
 ```
 */
function firstBodyOf({ exchanges, }: { readonly exchanges: readonly TransportExchange[]; },): Record<string, unknown> {
  const [first,] = exchanges;
  if (first === undefined)
    throw new Error('nothing was sent',);
  return JSON.parse(first.bodyJson ?? '{}',) as Record<string, unknown>;
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: createDeepSeekClient.name,
      // SEQUENTIAL: the run spend meter is process-wide, so cases that read its change must not overlap.
      concurrency: 1,
      children: [
        it({
          name: 'SENDS the wire id deepseek-flash to /chat/completions with the owner\'s bearer key, streaming usage on, '
            + 'the measured cap, JSON mode for a schema, the word json in the system prompt, and NO reasoning member; '
            + 'READS the answer back past comment lines and reasoning_content, and PRICES it at peak with the cache split',
          fn: async () => {
            const { transport, exchanges, } = scripted({
              replies: [{ status: 200, bodyText: streamOf({ usageChunk: DEEPSEEK_USAGE_CHUNK, done: true, }), },],
            },);
            const client = createDeepSeekClient({
              apiKey: 'cat-key-deepseek',
              transport,
              retryPolicy: ONE_QUICK_RETRY,
            },);
            const before = runSpendUsd({ provider: 'deepseek', },);

            const reply = await client.chatText({
              modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
              messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
              signal: SIGNAL,
              responseFormat: NAP_SCHEMA,
            },);

            expect(reply.text,).toBe('{"spot":"sunbeam"}',);
            expect(reply.usage,).toMatchObject({ prompt_tokens: 100, completion_tokens: 10, },);
            const [exchange,] = exchanges;
            expect(exchange?.url,).toBe('https://api.deepseek.com/chat/completions',);
            expect(exchange?.method,).toBe('POST',);
            expect(exchange?.headers.Authorization,).toBe('Bearer cat-key-deepseek',);
            const body = firstBodyOf({ exchanges, },);
            expect(body,).toMatchObject({
              model: 'deepseek-flash',
              stream: true,
              stream_options: { include_usage: true, },
              // THE json_schema TYPE IS REFUSED BY THIS API (HTTP 400, probed 2026-10-22): JSON mode instead.
              response_format: { type: 'json_object', },
            },);
            expect(typeof body.max_tokens,).toBe('number',);
            const wire = JSON.stringify(body,);
            for (const forbidden of ['reasoning', 'thinking', 'effort', '"provider"', '"store"',])
              expect(wire,).not.toContain(forbidden,);
            // The schema rides in the system prompt, whose text carries the word the API's JSON mode requires.
            expect(wire.toLowerCase(),).toContain('json',);
            expect(wire,).toContain('nap_spot',);
            // 40 hits at 0.006, 60 misses at 0.3 and 10 outputs at 1.2 USD per million.
            const priced = ((40 * 0.006) + (60 * 0.3) + (10 * 1.2)) / 1_000_000;
            expect(runSpendUsd({ provider: 'deepseek', },) - before,).toBeCloseTo(priced, 12,);
          },
        },),

        it({
          name: 'RETRIES a stream that stopped before [DONE] as the transport failure it is, and answers from the whole one',
          fn: async () => {
            const { transport, exchanges, } = scripted({
              replies: [
                { status: 200, bodyText: streamOf({ usageChunk: DEEPSEEK_USAGE_CHUNK, done: false, }), },
                { status: 200, bodyText: streamOf({ usageChunk: DEEPSEEK_USAGE_CHUNK, done: true, }), },
              ],
            },);
            const client = createDeepSeekClient({ apiKey: 'cat-key-deepseek', transport, retryPolicy: ONE_QUICK_RETRY, },);

            const reply = await client.chatText({
              modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
              messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
              signal: SIGNAL,
            },);

            expect(reply.text,).toBe('{"spot":"sunbeam"}',);
            expect(exchanges.length,).toBe(2,);
          },
        },),

        it({
          name: 'FAILS a 402 as a payment refusal, which is how the router learns this balance is spent',
          fn: async () => {
            const { transport, exchanges, } = scripted({
              replies: [{ status: 402, bodyText: '{"error":{"message":"Insufficient Balance"}}', },],
            },);
            const client = createDeepSeekClient({ apiKey: 'cat-key-deepseek', transport, retryPolicy: ONE_QUICK_RETRY, },);

            const failure: unknown = await rejectionOf(async function askForTheFailure(): Promise<unknown> {
              return await client.chatText({
                modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
                messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
                signal: SIGNAL,
              },);
            },);

            expect(failure,).toBeInstanceOf(ProviderHttpError,);
            expect(isPaymentRefusal({ error: failure, },),).toBe(true,);
            expect(exchanges.length,).toBe(1,);
          },
        },),

        it({
          name: 'THROWS before any request for every model but the one the key is granted for (THE LOCK)',
          fn: async () => {
            const { transport, exchanges, } = scripted({ replies: [{ status: 200, bodyText: '', },], },);
            const client = createDeepSeekClient({ apiKey: 'cat-key-deepseek', transport, },);

            const failure: unknown = await rejectionOf(async function askForTheFailure(): Promise<unknown> {
              return await client.chatText({
                modelId: SEAT_SYNTHETIC_TEXT_EVERYWHERE,
                messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
                signal: SIGNAL,
              },);
            },);

            expect(failure,).toBeInstanceOf(DeepSeekModelNotServedError,);
            expect(exchanges.length,).toBe(0,);
          },
        },),

        it({
          name: 'READS the balance with GET /user/balance and the same key, strict',
          fn: async () => {
            const { transport, exchanges, } = scripted({
              replies: [{
                status: 200,
                bodyText: '{"is_available":true,"balance_infos":[{"currency":"USD","total_balance":"9.96",'
                  + '"granted_balance":"0.00","topped_up_balance":"9.96"}]}',
              },],
            },);
            const client = createDeepSeekClient({ apiKey: 'cat-key-deepseek', transport, },);

            expect(await client.credits({ signal: SIGNAL, },),).toEqual({ isAvailable: true, totalUsd: 9.96, },);
            expect(exchanges[0]?.url,).toBe('https://api.deepseek.com/user/balance',);
            expect(exchanges[0]?.method,).toBe('GET',);
            expect(exchanges[0]?.headers.Authorization,).toBe('Bearer cat-key-deepseek',);
          },
        },),

        it({
          name: 'REFUSES a balance body of the wrong shape, and a failing status, as stated failures',
          fn: async () => {
            const odd = createDeepSeekClient({
              apiKey: 'cat-key-deepseek',
              transport: scripted({ replies: [{ status: 200, bodyText: '{"is_available":"yes"}', },], },).transport,
            },);
            const failure: unknown = await rejectionOf(async function askForTheFailure(): Promise<unknown> {
              return await odd.credits({ signal: SIGNAL, },);
            },);
            expect(failure,).toBeInstanceOf(DeepSeekBalanceShapeError,);

            const down = createDeepSeekClient({
              apiKey: 'cat-key-deepseek',
              transport: scripted({ replies: [{ status: 401, bodyText: 'no', },], },).transport,
              retryPolicy: ONE_QUICK_RETRY,
            },);
            const refused: unknown = await rejectionOf(async function askForTheFailure(): Promise<unknown> {
              return await down.credits({ signal: SIGNAL, },);
            },);
            expect(refused,).toBeInstanceOf(ProviderHttpError,);
          },
        },),
      ],
    },),

    describe({
      name: createXiaomiClient.name,
      // SEQUENTIAL: the run spend meter is process-wide, so cases that read its change must not overlap.
      concurrency: 1,
      children: [
        it({
          name: 'SENDS the wire id mimo-v2.6-flash to /v1/chat/completions with the schema unchanged and NO reasoning '
            + 'member, READS the answer, and PRICES it with the cached count',
          fn: async () => {
            const { transport, exchanges, } = scripted({
              replies: [{ status: 200, bodyText: streamOf({ usageChunk: XIAOMI_USAGE_CHUNK, done: true, }), },],
            },);
            const client = createXiaomiClient({ apiKey: 'cat-key-xiaomi', transport, retryPolicy: ONE_QUICK_RETRY, },);
            const before = runSpendUsd({ provider: 'xiaomi', },);

            const reply = await client.chatText({
              modelId: SEAT_OPENROUTER_ONLY_CHECKER,
              messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
              signal: SIGNAL,
              responseFormat: NAP_SCHEMA,
            },);

            expect(reply.text,).toBe('{"spot":"sunbeam"}',);
            expect(exchanges[0]?.url,).toBe('https://api.xiaomimimo.com/v1/chat/completions',);
            expect(exchanges[0]?.headers.Authorization,).toBe('Bearer cat-key-xiaomi',);
            const body = firstBodyOf({ exchanges, },);
            expect(body,).toMatchObject({
              model: 'mimo-v2.6-flash',
              stream: true,
              stream_options: { include_usage: true, },
              response_format: NAP_SCHEMA,
            },);
            const wire = JSON.stringify(body,);
            for (const forbidden of ['reasoning', 'thinking', 'effort', '"provider"', '"store"',])
              expect(wire,).not.toContain(forbidden,);
            // 50 cached at 0.0028, 50 uncached at 0.14 and 10 outputs at 0.28 USD per million.
            const priced = ((50 * 0.0028) + (50 * 0.14) + (10 * 0.28)) / 1_000_000;
            const spend = await client.spend({ signal: SIGNAL, },);
            expect(runSpendUsd({ provider: 'xiaomi', },) - before,).toBeCloseTo(priced, 12,);
            expect(spend.spentUsd,).toBeCloseTo(runSpendUsd({ provider: 'xiaomi', },), 12,);
          },
        },),

        it({
          name: 'FAILS a 402 as a payment refusal and THROWS before any request for every model but its one (THE LOCK)',
          fn: async () => {
            const spent = scripted({ replies: [{ status: 402, bodyText: '{"error":"Insufficient account balance"}', },], },);
            const client = createXiaomiClient({ apiKey: 'cat-key-xiaomi', transport: spent.transport, retryPolicy: ONE_QUICK_RETRY, },);
            const refusal: unknown = await rejectionOf(async function askForTheFailure(): Promise<unknown> {
              return await client.chatText({
                modelId: SEAT_OPENROUTER_ONLY_CHECKER,
                messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
                signal: SIGNAL,
              },);
            },);
            expect(isPaymentRefusal({ error: refusal, },),).toBe(true,);

            const locked = scripted({ replies: [{ status: 200, bodyText: '', },], },);
            const other = createXiaomiClient({ apiKey: 'cat-key-xiaomi', transport: locked.transport, },);
            const failure: unknown = await rejectionOf(async function askForTheFailure(): Promise<unknown> {
              return await other.chatText({
                modelId: SEAT_HYPER_OPENROUTER_UNMEASURED,
                messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
                signal: SIGNAL,
              },);
            },);
            expect(failure,).toBeInstanceOf(XiaomiModelNotServedError,);
            expect(locked.exchanges.length,).toBe(0,);
          },
        },),

        it({
          name: 'PACES every attempt to its request window: a full window makes the next call wait, and the wait is readable',
          fn: async () => {
            const { transport, } = scripted({
              replies: [{ status: 200, bodyText: streamOf({ usageChunk: XIAOMI_USAGE_CHUNK, done: true, }), },],
            },);
            const client = createXiaomiClient({ apiKey: 'cat-key-xiaomi', transport, requestsPerMinute: 2, },);
            expect(client.pace.waitMs(),).toBe(0,);
            await Promise.all([1, 2,].map(async function askOnce(): Promise<unknown> {
              return await client.chatText({
                modelId: SEAT_OPENROUTER_ONLY_CHECKER,
                messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
                signal: SIGNAL,
              },);
            },),);
            expect(client.pace.waitMs(),).toBeGreaterThan(0,);
          },
        },),
      ],
    },),
  ],
},);
