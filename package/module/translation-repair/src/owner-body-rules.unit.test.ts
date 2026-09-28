/**
 Tests that every provider client's request body keeps the owner's standing
 rules, and that a seat the owner dropped from OpenRouter stays off it
 (ledger P11).

 WHY ONE TABLE. The rules ("never set thinking, budget_tokens or
 reasoning_effort; always send max_tokens") were guarded for the Hyper and
 OpenRouter bodies in one routing test, and the Synthetic and Bedrock bodies
 by nothing: each client builds its own body, so a knob added to one is
 caught only where a test reads that body. And Qwen3.8-27B and glm-5.3 stayed
 off OpenRouter only because their cards carry no OpenRouter block, so
 re-adding one would route them there with nothing to say so.

 Fixtures are cat-themed invention.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type BedrockLedger,
  createBedrockClient,
  createHyperClient,
  createOpenRouterClient,
  createSyntheticClient,
  MODEL_CARDS,
  OPENROUTER_DROPPED_SEATS,
  reachOf,
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_HYPER_ONLY,
  SEAT_OPENROUTER_ONLY,
  SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
  type SyntheticClient,
  type TransportExchange,
} from '../dist/final/node/index.mjs';

/**
 Keys the owner's instruction of 2026-08-25 forbids in any body, at any depth.
 */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  'thinking',
  'budget_tokens',
  'reasoning_effort',
  'reasoning',
  'include_reasoning',
],);

/**
 Retry policy that makes one attempt.
 */
const ONE_ATTEMPT = {
  limit: 0,
  baseMs: 1,
};

/**
 Ledger that holds nothing, for the Bedrock client, which never reaches it here.
 */
const EMPTY_LEDGER: BedrockLedger = {
  path: '/nowhere/bedrock-spend.jsonl',
  note: async function note(): Promise<void> {
    await Promise.resolve();
  },
  read: async function read() {
    return {
      creditUsd: 200,
      spentUsd: 0,
      reckonedUsd: 0,
      remainingUsd: 200,
      calls: 0,
    };
  },
};

/**
 Every key an object carries, at every depth.

 @param value - parsed body or any part of it

 @returns Keys, repeated where they repeat

 @example
 ```ts
 const keys = keysOf(JSON.parse(bodyJson,),);
 ```
 */
function keysOf(value: unknown,): readonly string[] {
  /**
   Values still to walk.
   */
  const pending: unknown[] = [value,];
  /**
   Keys found so far.
   */
  const keys: string[] = [];
  while (pending.length > 0) {
    /**
     Next value.
     */
    const next = pending.pop();
    if (Array.isArray(next,)) {
      for (const item of next as readonly unknown[])
        pending.push(item,);
    }
    else if (((typeof next) === 'object') && (next !== null)) {
      for (const [key, inner,] of Object.entries(next,)) {
        keys.push(key,);
        pending.push(inner,);
      }
    }
  }
  return keys;
}

/**
 One provider's client over a transport that records the body and fails.

 @param bodies - where the recorded bodies go

 @returns Transport recording each chat body

 @example
 ```ts
 const transport = recordingTransport({ bodies, },);
 ```
 */
function recordingTransport(
  { bodies, }: { readonly bodies: string[]; },
): (exchange: TransportExchange,) => Promise<never> {
  return async function record(exchange,): Promise<never> {
    bodies.push(exchange.bodyJson ?? '',);
    await Promise.resolve();
    throw new Error('recorded, not sent',);
  };
}

/**
 Awaits a call whose failure is expected, since the transport records and
 refuses every body.

 @param call - the call to settle

 @example
 ```ts
 await settled(client.chatText(request,),);
 ```
 */
async function settled(call: Promise<unknown>,): Promise<void> {
  try {
    await call;
  }
  catch (error) {
    // The transport refuses by design; the recorded body is what is read.
    void error;
  }
}

/**
 Each provider, the seat it alone or first serves, and a client over the
 recording transport.

 @param bodies - where the recorded bodies go

 @returns One row per provider

 @example
 ```ts
 const rows = providerRows({ bodies, },);
 ```
 */
function providerRows(
  { bodies, }: { readonly bodies: string[]; },
): readonly { readonly provider: string; readonly modelId: string; readonly client: Pick<SyntheticClient, 'chatJson' | 'chatText'>; }[] {
  /**
   Transport shared by every row.
   */
  const transport = recordingTransport({ bodies, },);
  return [
    {
      provider: 'synthetic',
      modelId: SEAT_SYNTHETIC_VISION_NO_OPENROUTER,
      client: createSyntheticClient({ apiKey: 'whiskers', transport, retryPolicy: ONE_ATTEMPT, },),
    },
    {
      provider: 'hyper',
      modelId: SEAT_HYPER_ONLY,
      client: createHyperClient({ apiKey: 'whiskers', transport, retryPolicy: ONE_ATTEMPT, },),
    },
    {
      provider: 'openrouter',
      modelId: SEAT_OPENROUTER_ONLY,
      client: createOpenRouterClient({ apiKey: 'whiskers', transport, retryPolicy: ONE_ATTEMPT, },),
    },
    {
      provider: 'bedrock',
      modelId: SEAT_BEDROCK_ONLY_TEXT,
      client: createBedrockClient({ apiKey: 'whiskers', ledger: EMPTY_LEDGER, transport, retryPolicy: ONE_ATTEMPT, },),
    },
  ];
}

await describe({
  name: 'the owner\'s standing body rules hold on every provider (ledger P11)',
  children: [
    it({
      name: 'EVERY BODY CARRIES max_tokens AND NO THINKING, BUDGET OR REASONING KNOB, on the text call and on '
        + 'the schema\'d call of each of the four providers',
      fn: async () => {
        /**
         Bodies the transport recorded, in call order.
         */
        const bodies: string[] = [];
        /**
         What each row's two calls sent.
         */
        const findings: string[] = [];
        for (const row of providerRows({ bodies, },)) {
          /**
           Bodies before this row's calls.
           */
          const before = bodies.length;
          // oxlint-disable-next-line no-await-in-loop -- the rows share one recorder, read in order
          await settled(row.client.chatText({
            modelId: row.modelId as never,
            messages: [{ role: 'user', content: 'Where does the cat nap?', },],
            signal: new AbortController().signal,
          },),);
          // oxlint-disable-next-line no-await-in-loop -- the rows share one recorder, read in order
          await settled(row.client.chatJson({
            modelId: row.modelId as never,
            messages: [{ role: 'user', content: 'Where does the cat nap?', },],
            signal: new AbortController().signal,
            responseFormat: {
              type: 'json_schema',
              json_schema: {
                name: 'nap_spot',
                strict: true,
                schema: {
                  type: 'object',
                  properties: { spot: { type: 'string', }, },
                  required: ['spot',],
                  additionalProperties: false,
                },
              },
            },
            validate: function isSpot(value: unknown,): value is { readonly spot: string; } {
              return ((typeof value) === 'object') && (value !== null) && ('spot' in value);
            },
          },),);
          if ((bodies.length - before) < 2)
            findings.push(`${row.provider}: ${String(bodies.length - before,)} bodies recorded`,);
          for (const bodyJson of bodies.slice(before,)) {
            /**
             Body as sent.
             */
            const body = JSON.parse(bodyJson,) as Record<string, unknown>;
            if (!(((typeof body.max_tokens) === 'number') && (body.max_tokens > 0)))
              findings.push(`${row.provider}: no max_tokens`,);
            for (const key of keysOf(body,).filter(function forbidden(found,): boolean {
              return FORBIDDEN_KEYS.has(found,);
            },))
              findings.push(`${row.provider}: ${key}`,);
          }
        }
        expect(findings,).toEqual([],);
      },
    },),
    it({
      name: 'A SEAT DROPPED FROM OPENROUTER HAS NO OPENROUTER BLOCK AND NO OPENROUTER REACH, so re-adding a block '
        + 'fails here before a run routes the seat there',
      fn: async () => {
        expect(OPENROUTER_DROPPED_SEATS.size,).toBeGreaterThan(0,);
        for (const modelId of OPENROUTER_DROPPED_SEATS) {
          expect({
            modelId,
            block: MODEL_CARDS[modelId].openrouter !== undefined,
            reach: reachOf({ modelId, },).openrouter,
          },).toEqual({
            modelId,
            block: false,
            reach: false,
          },);
        }
      },
    },),
  ],
},);
