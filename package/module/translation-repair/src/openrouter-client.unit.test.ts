/**
 * Tests for the OpenRouter client over a recorded transport.
 *
 * THE STREAM SHAPE IS THE ONE THE PROBE CAPTURED on 2026-09-03 from
 * `deepseek/deepseek-v4-flash-0731` via Inceptron: a `: OPENROUTER PROCESSING`
 * comment line, reasoning deltas before content, a final chunk carrying
 * `usage` with `cost`, and the `[DONE]` sentinel. Fixtures are cat-themed
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
  createOpenRouterClient,
  OPENROUTER_CHAT_URL,
  OPENROUTER_CREDITS_URL,
  OpenRouterModelNotServedError,
  SyntheticHttpError,
  type TransportExchange,
} from '../dist/final/node/index.mjs';

/**
 * One chat completion chunk as the gateway sends it.
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
    id: 'gen-1788450765-akMiAoFBnp64lvAW8sIs',
    object: 'chat.completion.chunk',
    created: 1_788_450_765,
    model: 'deepseek/deepseek-v4-flash-0731',
    provider: 'Inceptron',
    choices: [{
      index: 0,
      delta: {
        role: 'assistant',
        ...delta,
      },
      finish_reason: null,
    },],
    ...rest,
  },)}\n\n`;
}

/**
 * Whole stream the captured call answered with, answer and cost included.
 */
const RECORDED_STREAM = [
  ': OPENROUTER PROCESSING\n\n',
  chunkOf({ delta: { content: '', reasoning: 'The cat', }, },),
  chunkOf({ delta: { content: '{"spot":', reasoning: null, }, },),
  chunkOf({ delta: { content: ' "windowsill"}', }, },),
  chunkOf({
    delta: { content: '', },
    rest: {
      usage: {
        prompt_tokens: 342,
        completion_tokens: 400,
        total_tokens: 742,
        cost: 0.00015646,
        is_byok: false,
      },
    },
  },),
  'data: [DONE]\n\n',
].join('',);

/**
 * Abort signal every call here carries.
 */
const SIGNAL = new AbortController().signal;

/**
 * Builds a client over a transport that records what it was sent.
 *
 * @param reply - what the chat endpoint answers
 *
 * @returns Client plus the exchanges the transport saw
 *
 * @example
 * ```ts
 * const { client, exchanges, } = recordedClient({},);
 * ```
 */
function recordedClient(
  { reply = { status: 200, bodyText: RECORDED_STREAM, }, }: {
    readonly reply?: { readonly status: number; readonly bodyText: string; };
  },
) {
  /**
   * Every exchange the transport was handed.
   */
  const exchanges: TransportExchange[] = [];
  return {
    exchanges,
    client: createOpenRouterClient({
      apiKey: 'test-key',
      transport: async function transport(exchange,) {
        exchanges.push(exchange,);
        if (exchange.url === OPENROUTER_CREDITS_URL)
          return { status: 200, bodyText: '{"data":{"total_credits":1913,"total_usage":1855.38}}', };
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
  name: createOpenRouterClient.name,
  children: [
    it({
      name: 'SENDS the chat completions body with the OpenRouter slug, the routing preferences, the '
        + 'schema in both places, and streaming usage on, and READS the answer and its cost back',
      fn: async () => {
        const { client, exchanges, } = recordedClient({},);
        /**
         * One schema'd call as a stage would make it.
         */
        const reply = await client.chatText({
          modelId: 'deepseek-v4-flash-0731',
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

        expect(reply.text,).toBe('{"spot": "windowsill"}',);
        expect(reply.usage,).toMatchObject({
          prompt_tokens: 342,
          completion_tokens: 400,
        },);

        /**
         * What went on the wire.
         */
        const [exchange,] = exchanges;
        if (exchange === undefined)
          throw new Error('nothing was sent',);
        expect(exchange.url,).toBe(OPENROUTER_CHAT_URL,);
        expect(exchange.headers.Authorization,).toBe('Bearer test-key',);
        /**
         * Body as the gateway would parse it.
         */
        const body: unknown = JSON.parse(exchange.bodyJson ?? '{}',);
        expect(body,).toMatchObject({
          model: 'deepseek/deepseek-v4-flash-0731',
          stream: true,
          stream_options: { include_usage: true, },
          provider: {
            zdr: true,
            require_parameters: true,
            ignore: ['openinference',],
          },
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
        // The schema is restated in the system prompt as on the Synthetic
        // path, so a model that ignores `response_format` still reads it.
        expect(JSON.stringify(body,),).toContain('nap_spot',);
        expect(JSON.stringify(body,),).not.toContain('max_tokens',);
      },
    },),

    it({
      name: 'KEEPS MiniMax M3 off Parasail on the wire: the body\'s provider.ignore carries the '
        + 'catalog row\'s slug, so the endpoint that answers into the reasoning channel is never routed to',
      fn: async () => {
        const { client, exchanges, } = recordedClient({},);
        await client.chatText({
          modelId: 'minimax-m3',
          messages: [{ role: 'user', content: 'Where does the cat sleep?', },],
          signal: SIGNAL,
        },);
        /**
         * What went on the wire.
         */
        const [exchange,] = exchanges;
        if (exchange === undefined)
          throw new Error('nothing was sent',);
        /**
         * Body as the gateway would parse it.
         */
        const body: unknown = JSON.parse(exchange.bodyJson ?? '{}',);
        expect(body,).toMatchObject({
          model: 'minimax/minimax-m3',
          provider: {
            zdr: true,
            require_parameters: true,
            ignore: ['parasail',],
          },
        },);
      },
    },),

    it({
      name: 'READS credits purchased, used and remaining off the credits endpoint',
      fn: async () => {
        const { client, } = recordedClient({},);
        expect(await client.credits({ signal: SIGNAL, },),).toEqual({
          purchasedUsd: 1_913,
          usedUsd: 1_855.38,
          remainingUsd: 1_913 - 1_855.38,
        },);
      },
    },),

    it({
      name: 'REFUSES a roster model it has no slug for before touching the wire, since that is a '
        + 'routing mistake in our own code',
      fn: async () => {
        const { client, exchanges, } = recordedClient({},);
        /**
         * What a call for a name outside the catalog produces.
         */
        let thrown: unknown;
        try {
          await client.chatText({
            // A departed identity no catalog serves, cast past the roster type
            // the way a stale artifact could carry it.
            modelId: 'hf:zai-org/GLM-4.7-Flash' as never,
            messages: [{ role: 'user', content: 'meow', },],
            signal: SIGNAL,
          },);
        } catch (error) {
          thrown = error;
        }
        expect(thrown instanceof OpenRouterModelNotServedError,).toBe(true,);
        expect(exchanges,).toHaveLength(0,);
      },
    },),

    it({
      name: 'THROWS the shared HTTP failure class on a non-success status, which the budget layer '
        + 'reads for 402 and 429',
      fn: async () => {
        const { client, } = recordedClient({
          reply: {
            status: 402,
            bodyText: '{"error":{"message":"insufficient credits"}}',
          },
        },);
        /**
         * What a payment refusal produces.
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
        expect(thrown instanceof SyntheticHttpError,).toBe(true,);
        expect((thrown as SyntheticHttpError).status,).toBe(402,);
      },
    },),
  ],
},);
