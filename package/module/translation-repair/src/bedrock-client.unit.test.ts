/**
 * Tests for the Bedrock client over a recorded transport.
 *
 * THE STREAM SHAPES ARE THE ONES THE PROBES CAPTURED on 2026-09-07 from
 * bedrock-mantle in us-east-1: the Gemma route answers content chunks, a
 * usage chunk and `[DONE]`; the gpt-oss route answers reasoning deltas,
 * content chunks and a usage chunk with no sentinel. Fixtures are cat-themed
 * invention; no corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type BedrockLedger,
  type BedrockLedgerEntry,
  BedrockModelNotServedError,
  createBedrockClient,
  SyntheticHttpError,
  type TransportExchange,
} from '../dist/final/node/index.mjs';

/**
 * One chat completion chunk as the endpoint sends it.
 *
 * @param delta - delta fields for the single choice
 *
 * @param rest - top-level fields beyond the choice, usage included
 *
 * @returns Event line, newline-terminated
 *
 * @example
 * ```ts
 * const raw = chunkOf({ delta: { content: '{"spot":', }, },);
 * ```
 */
function chunkOf(
  {
    delta,
    rest = {},
  }: {
    readonly delta: Readonly<Record<string, unknown>>;
    readonly rest?: Readonly<Record<string, unknown>>;
  },
): string {
  return `data: ${JSON.stringify({
    id: 'chatcmpl-595717d5-4cdb-44eb-bc27-2f6c1f0f1a1b',
    object: 'chat.completion.chunk',
    created: 1_788_811_674,
    choices: [{
      index: 0,
      delta,
      finish_reason: null,
    },],
    ...rest,
  },)}\n\n`;
}

/**
 * Usage chunk with no choices, which both routes end on.
 */
const USAGE_CHUNK = `data: ${JSON.stringify({
  id: 'chatcmpl-595717d5-4cdb-44eb-bc27-2f6c1f0f1a1b',
  object: 'chat.completion.chunk',
  created: 1_788_811_674,
  choices: [],
  usage: {
    prompt_tokens: 90,
    completion_tokens: 10,
    total_tokens: 100,
  },
},)}\n\n`;

/**
 * Whole stream the Gemma route answered with.
 */
const GEMMA_STREAM = [
  chunkOf({ delta: { role: 'assistant', content: '', }, },),
  chunkOf({ delta: { content: '{"spot":', }, },),
  chunkOf({ delta: { content: '"sunbeam"}', }, },),
  USAGE_CHUNK,
  'data: [DONE]\n\n',
].join('',);

/**
 * Whole stream the gpt-oss route answered with: reasoning first, no sentinel.
 */
const GPT_OSS_STREAM = [
  chunkOf({ delta: { role: 'assistant', reasoning: 'The user asks where', }, },),
  chunkOf({ delta: { reasoning: ' the cat naps.', }, },),
  chunkOf({ delta: { content: '{"spot":"windowsill"}', }, },),
  USAGE_CHUNK,
].join('',);

/**
 * Abort signal every call here carries.
 */
const SIGNAL = new AbortController().signal;

/**
 * In-memory ledger recording what the client notes and answering a fixed
 * reading.
 *
 * @param remainingUsd - what the reading says is left
 *
 * @returns Ledger plus the entries noted into it
 *
 * @example
 * ```ts
 * const { ledger, noted, } = memoryLedger({ remainingUsd: 150, },);
 * ```
 */
function memoryLedger({ remainingUsd = 150, }: { readonly remainingUsd?: number; },) {
  /**
   * Entries the client noted, in order.
   */
  const noted: BedrockLedgerEntry[] = [];

  /**
   * Ledger surface over the list.
   */
  const ledger: BedrockLedger = {
    path: '/nowhere/bedrock-spend.jsonl',
    note: async function note(entry,): Promise<void> {
      noted.push(entry,);
    },
    read: async function read() {
      return {
        creditUsd: 200,
        spentUsd: 200 - remainingUsd,
        remainingUsd,
        calls: noted.length,
      };
    },
  };
  return {
    ledger,
    noted,
  };
}

/**
 * Builds a client over a transport that records what it was sent.
 *
 * @param reply - what the chat endpoint answers
 *
 * @returns Client plus the exchanges the transport saw and the ledger's notes
 *
 * @example
 * ```ts
 * const { client, exchanges, } = recordedClient({},);
 * ```
 */
function recordedClient(
  { reply = { status: 200, bodyText: GEMMA_STREAM, }, }: {
    readonly reply?: { readonly status: number; readonly bodyText: string; };
  },
) {
  /**
   * Every exchange the transport was handed.
   */
  const exchanges: TransportExchange[] = [];

  /**
   * Ledger the client writes to.
   */
  const { ledger, noted, } = memoryLedger({},);
  return {
    exchanges,
    noted,
    client: createBedrockClient({
      apiKey: 'test-key',
      ledger,
      baseUrl: 'https://mantle.invalid',
      transport: async function transport(exchange,) {
        exchanges.push(exchange,);
        return reply;
      },
      retryPolicy: {
        limit: 0,
        baseMs: 1,
      },
    },),
  };
}

await describe({
  name: createBedrockClient.name,
  children: [
    it({
      name: 'SENDS the chat completions body on the Gemma route with the Bedrock spelling, the schema '
        + 'in both places, streaming usage on, no provider field and no store, and READS the answer '
        + 'back, PRICING it into the ledger',
      fn: async () => {
        const { client, exchanges, noted, } = recordedClient({},);

        /**
         * One schema'd call as a stage would make it, on the shared seat.
         */
        const reply = await client.chatText({
          modelId: 'gemma-4-26b-a4b-it',
          messages: [
            { role: 'system', content: 'You are a careful cat.', },
            { role: 'user', content: 'Where does the cat sleep?', },
          ],
          signal: SIGNAL,
          responseFormat: {
            type: 'json_schema',
            json_schema: {
              name: 'nap_spot',
              schema: {
                type: 'object',
                required: ['spot',],
                properties: { spot: { type: 'string', }, },
              },
            },
          },
        },);

        expect(reply.text,).toBe('{"spot":"sunbeam"}',);
        expect(reply.usage,).toMatchObject({
          prompt_tokens: 90,
          completion_tokens: 10,
        },);

        /**
         * What went on the wire.
         */
        const [exchange,] = exchanges;
        if (exchange === undefined)
          throw new Error('nothing was sent',);
        expect(exchange.url,).toBe('https://mantle.invalid/openai/v1/chat/completions',);
        expect(exchange.headers.Authorization,).toBe('Bearer test-key',);

        /**
         * Body as the endpoint would parse it.
         */
        const body: unknown = JSON.parse(exchange.bodyJson ?? '{}',);
        expect(body,).toMatchObject({
          model: 'google.gemma-4-26b-a4b',
          stream: true,
          stream_options: { include_usage: true, },
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'nap_spot',
              schema: {
                type: 'object',
                required: ['spot',],
                properties: { spot: { type: 'string', }, },
              },
            },
          },
        },);
        expect(JSON.stringify(body,),).toContain('nap_spot',);
        expect(JSON.stringify(body,),).not.toContain('"provider"',);
        expect(JSON.stringify(body,),).not.toContain('"store"',);
        expect(JSON.stringify(body,),).not.toContain('reasoning_effort',);
        expect(JSON.stringify(body,),).not.toContain('max_tokens',);

        /**
         * What the ledger was told.
         */
        const [entry,] = noted;
        if (entry === undefined)
          throw new Error('nothing was noted',);
        expect(entry.model,).toBe('google.gemma-4-26b-a4b',);
        expect(entry.promptTokens,).toBe(90,);
        expect(entry.completionTokens,).toBe(10,);
        expect(entry.usd,).toBeGreaterThan(0,);
      },
    },),

    it({
      name: 'READS the gpt-oss route\'s stream, which ends on its usage chunk with no sentinel and '
        + 'carries reasoning deltas first, under /v1',
      fn: async () => {
        const { client, exchanges, } = recordedClient({
          reply: {
            status: 200,
            bodyText: GPT_OSS_STREAM,
          },
        },);

        /**
         * One plain call on the seat every provider serves.
         */
        const reply = await client.chatText({
          modelId: 'hf:openai/gpt-oss-120b',
          messages: [{ role: 'user', content: 'Where does the cat nap?', },],
          signal: SIGNAL,
        },);
        expect(reply.text,).toBe('{"spot":"windowsill"}',);
        expect(reply.usage?.completion_tokens,).toBe(10,);
        expect(exchanges[0]?.url,).toBe('https://mantle.invalid/v1/chat/completions',);
        expect(JSON.parse(exchanges[0]?.bodyJson ?? '{}',),).toMatchObject({ model: 'openai.gpt-oss-120b', },);
      },
    },),

    it({
      name: 'REFUSES a Gemma-route stream cut off before its sentinel as malformed rather than '
        + 'returning the fragment, since a stream that stopped early comes back as 200',
      fn: async () => {
        const { client, noted, } = recordedClient({
          reply: {
            status: 200,
            bodyText: chunkOf({ delta: { content: '{"spot":', }, },),
          },
        },);

        /**
         * What the cut stream produced.
         */
        let thrown: unknown;
        try {
          await client.chatText({
            modelId: 'google.gemma-4-e2b',
            messages: [{ role: 'user', content: 'meow', },],
            signal: SIGNAL,
          },);
        } catch (error) {
          thrown = error;
        }
        expect(thrown,).toBeInstanceOf(Error,);
        expect((thrown as Error).name,).toBe('MalformedCompletionError',);
        expect(noted,).toHaveLength(0,);
      },
    },),

    it({
      name: 'READS the ledger for its credits, which is this provider\'s whole budget signal',
      fn: async () => {
        const { client, } = recordedClient({},);
        expect(await client.credits({ signal: SIGNAL, },),).toEqual({
          creditUsd: 200,
          spentUsd: 50,
          remainingUsd: 150,
          calls: 0,
        },);
      },
    },),

    it({
      name: 'REFUSES a roster model it has no spelling for before touching the wire, since that is a '
        + 'routing mistake in our own code',
      fn: async () => {
        const { client, exchanges, } = recordedClient({},);

        /**
         * What a call for a seat this provider does not serve produces.
         */
        let thrown: unknown;
        try {
          await client.chatText({
            modelId: 'hf:moonshotai/Kimi-K3',
            messages: [{ role: 'user', content: 'meow', },],
            signal: SIGNAL,
          },);
        } catch (error) {
          thrown = error;
        }
        expect(thrown instanceof BedrockModelNotServedError,).toBe(true,);
        expect(exchanges,).toHaveLength(0,);
      },
    },),

    it({
      name: 'THROWS the shared HTTP failure class on a non-success status, which the budget layer '
        + 'reads for a refusal, and NOTES nothing',
      fn: async () => {
        const { client, noted, } = recordedClient({
          reply: {
            status: 429,
            bodyText: '{"error":{"message":"Too many requests"}}',
          },
        },);

        /**
         * What the refused call produced.
         */
        let thrown: unknown;
        try {
          await client.chatText({
            modelId: 'google.gemma-4-31b',
            messages: [{ role: 'user', content: 'meow', },],
            signal: SIGNAL,
          },);
        } catch (error) {
          thrown = error;
        }
        expect(thrown instanceof SyntheticHttpError,).toBe(true,);
        expect((thrown as SyntheticHttpError).status,).toBe(429,);
        expect(noted,).toHaveLength(0,);
      },
    },),

    it({
      name: 'VALIDATES a schema\'d answer through the shared outcome reader on chatJson',
      fn: async () => {
        const { client, } = recordedClient({},);

        /**
         * Outcome of a guarded call.
         */
        const outcome = await client.chatJson({
          modelId: 'google.gemma-4-e2b',
          messages: [{ role: 'user', content: 'Where does the cat nap?', },],
          signal: SIGNAL,
          validate: function isNapSpot(value: unknown,): value is { readonly spot: string; } {
            return ((typeof value) === 'object') && (value !== null) && ('spot' in value);
          },
        },);
        expect(outcome.kind,).toBe('ok',);
        if (outcome.kind === 'ok')
          expect(outcome.value.spot,).toBe('sunbeam',);
      },
    },),
  ],
},);
