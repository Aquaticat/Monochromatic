/**
 * Tests for the credit-metered provider's client: the Messages-protocol body
 * it builds, the stream grammar it names, the spelling it sends, and the
 * balance it reads.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  createHyperClient,
  CreditsShapeError,
  HYPER_API_VERSION,
  HYPER_CREDITS_URL,
  HYPER_MESSAGES_URL,
  HYPER_PER_MODEL_CONCURRENCY,
  isJsonRecord,
  MalformedCompletionError,
  ModelNotServedError,
  type ModelTransport,
  type RosterModelId,
  SyntheticHttpError,
  type TransportExchange,
  type TransportReply,
} from '../dist/final/node/index.mjs';

/**
 * Delay of the deliberately slow test transport.
 */
const SLOW_TRANSPORT_MS = 30;

/**
 * Calls fired at one model to show they are not serialised.
 *
 * One beyond width measured live,
 * proving measured arm did not become artificial local ceiling.
 */
const OVERLAPPING_CALLS = 65;

/**
 * Injected finite width proving test seam remains functional.
 */
const FINITE_TEST_WIDTH = 2;

/**
 * Single user message reused across exchanges.
 */
const MESSAGES = [
  {
    role: 'system' as const,
    content: '你是一只认真的猫。',
  },
  {
    role: 'user' as const,
    content: '这段翻译对吗？',
  },
];

/**
 * Structured-output constraint the tool is built from.
 */
const RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'cat_verdict',
    schema: {
      type: 'object',
      properties: { verdict: { type: 'string', }, },
      required: ['verdict',],
    },
  },
};

/**
 * Builds a drained Messages-protocol body carrying one tool call.
 *
 * MIRRORS A LIVE CAPTURE, `ping` frame included: the keep-alive is a real
 * event this provider sends, and a reader that chokes on it fails only against
 * the live API where nothing can be replayed.
 *
 * @param fragments - tool-argument fragments in arrival order
 *
 * @param stopReason - reason the message ended with
 *
 * @returns Whole `text/event-stream` body as the transport drains it
 *
 * @example
 * ```ts
 * const body = messagesBody({ fragments: ['{"verdict":', '"pass"}',], },);
 * ```
 */
function messagesBody(
  {
    fragments,
    stopReason = 'tool_use',
  }: {
    readonly fragments: readonly string[];
    readonly stopReason?: string;
  },
): string {
  /**
   * Serialized events in stream order, opening and closing a tool block.
   */
  const events = [
    {
      type: 'message_start',
      message: { usage: { input_tokens: 41, output_tokens: 1, }, },
    },
    { type: 'ping', },
    {
      type: 'content_block_start',
      index: 0,
      content_block: { type: 'tool_use', name: 'cat_verdict', input: {}, },
    },
    ...fragments.map(function toDelta(fragment,) {
      return {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'input_json_delta', partial_json: fragment, },
      };
    },),
    {
      type: 'content_block_stop',
      index: 0,
    },
    {
      type: 'message_delta',
      delta: { stop_reason: stopReason, },
      usage: { output_tokens: 17, },
    },
    { type: 'message_stop', },
  ];

  return [
    ...events.map(function toDataLine(event,) {
      return `data: ${JSON.stringify(event,)}`;
    },),
    '',
  ].join('\n\n',);
}

/**
 * Recorded reply carrying a whole tool call split across fragments.
 */
const TOOL_CALL_BODY = messagesBody({
  fragments: [
    '{"verdict":',
    '"pass"}',
  ],
},);

/**
 * Recorded reply cut off before `message_stop`, which is how a stream the
 * provider truncated arrives: HTTP 200 carrying half a message.
 */
const CUT_TOOL_CALL_BODY = 'data: {"type":"content_block_delta","index":0,'
  + '"delta":{"type":"input_json_delta","partial_json":"{\\"verdict\\":"}}\n\n';

/**
 * Verdict shape the chatJson tests validate against.
 */
type CatVerdict = { readonly verdict: string; };

/**
 * Guards parsed model JSON as a verdict.
 *
 * @param value - parsed candidate
 *
 * @returns Whether value carries a string verdict
 *
 * @example
 * ```ts
 * isCatVerdict({ verdict: 'pass', },);
 * ```
 */
function isCatVerdict(value: unknown,): value is CatVerdict {
  return isJsonRecord(value,) && ((typeof value.verdict) === 'string');
}

/**
 * Builds a transport replaying recorded replies in order while recording every
 * exchange for assertions.
 *
 * @param replies - replies replayed in call order, last one repeating
 *
 * @returns Transport plus its recorded exchanges
 *
 * @example
 * ```ts
 * const { transport, exchanges, } = recordedTransport({ replies: [reply,], },);
 * ```
 */
function recordedTransport(
  { replies, }: { readonly replies: readonly TransportReply[]; },
): {
  readonly transport: ModelTransport;
  readonly exchanges: TransportExchange[];
} {
  /**
   * Every exchange the client performed, in order.
   */
  const exchanges: TransportExchange[] = [];

  return {
    transport: async function replay(exchange,) {
      exchanges.push(exchange,);

      /**
       * Reply for this exchange; the last recorded reply repeats.
       */
      const reply = replies[Math.min(
        exchanges.length - 1,
        replies.length - 1,
      )];
      if (reply === undefined)
        throw new Error('recordedTransport needs at least one reply',);
      return reply;
    },
    exchanges,
  };
}

/**
 * Reads the body one recorded exchange sent, parsed.
 *
 * @param exchanges - exchanges the transport recorded
 *
 * @returns Parsed request body of the first exchange
 *
 * @example
 * ```ts
 * const body = sentBody({ exchanges, },);
 * ```
 */
function sentBody(
  { exchanges, }: { readonly exchanges: readonly TransportExchange[]; },
): Record<string, unknown> {
  /**
   * First exchange, which every test here performs exactly one of.
   */
  const [exchange,] = exchanges;

  /**
   * Serialized body it carried, absent on a GET.
   */
  const bodyJson = exchange?.bodyJson;
  if (bodyJson === undefined)
    throw new Error('exchange carried no body',);

  /**
   * Parsed body, checked rather than asserted into shape.
   */
  const parsed: unknown = JSON.parse(bodyJson,);
  if (!isJsonRecord(parsed,))
    throw new Error('request body is not a JSON object',);
  return parsed;
}

await describe({
  name: createHyperClient.name,
  children: [
    it({
      name: 'ACCEPTS a shared model under this provider\'s own spelling',
      fn: async () => {
        /** Transport replaying one recorded tool call. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        /** Reply of one exchange naming the roster spelling. */
        const reply = await client.chatText({
          modelId: 'hf:moonshotai/Kimi-K3',
          messages: MESSAGES,
          signal: new AbortController().signal,
          responseFormat: RESPONSE_FORMAT,
        },);

        // THE ROSTER NAMES IT ONE WAY AND THE WIRE ANOTHER. A body carrying
        // the roster spelling is a 404 against the live API.
        expect(sentBody({ exchanges, },).model,).toBe('kimi-k3',);
        expect(exchanges.at(0,)?.label,).toBe('kimi-k3',);
        expect(reply.text,).toBe('{"verdict":"pass"}',);
        expect(reply.usage,).toEqual({
          prompt_tokens: 41,
          completion_tokens: 17,
          total_tokens: 58,
        },);
        expect(reply.finishReason,).toBe('tool_use',);
      },
    },),

    it({
      name: 'names the anthropic stream grammar on every exchange',
      fn: async () => {
        /** Transport replaying one recorded tool call. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        await client.chatText({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: new AbortController().signal,
          responseFormat: RESPONSE_FORMAT,
        },);

        // THE SILENT ONE. A body drained by the other provider's reader yields
        // an empty answer channel, which every guard above reads as a
        // well-behaved call that produced nothing. Nothing else in the reply
        // distinguishes that from a model declining to answer.
        expect(exchanges.at(0,)?.wireFormat,).toBe('anthropic',);
      },
    },),

    it({
      name: 'sends bearer auth, the dated protocol version, and the messages endpoint',
      fn: async () => {
        /** Transport replaying one recorded tool call. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        await client.chatText({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: new AbortController().signal,
        },);

        /** Exchange the client performed. */
        const exchange = exchanges.at(0,);

        expect(exchange?.url,).toBe(HYPER_MESSAGES_URL,);
        expect(exchange?.method,).toBe('POST',);
        // MEASURED: `x-api-key`, which this protocol normally uses, draws
        // `401 missing authorization` from this gateway.
        expect(exchange?.headers.Authorization,).toBe('Bearer test-key',);
        expect(exchange?.headers['anthropic-version'],).toBe(HYPER_API_VERSION,);
      },
    },),

    it({
      name: 'lifts the system message out and streams unconditionally',
      fn: async () => {
        /** Transport replaying one recorded tool call. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        await client.chatText({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: new AbortController().signal,
        },);

        /** Body the client assembled. */
        const body = sentBody({ exchanges, },);

        expect(body.stream,).toBe(true,);
        expect(body.system,).toBe('你是一只认真的猫。',);
        expect(body.messages,).toEqual([
          { role: 'user', content: [{ type: 'text', text: '这段翻译对吗？', },], },
        ],);
        // A free-text call offers no tool at all.
        expect(body.tools,).toBe(undefined,);
      },
    },),

    it({
      name: 'describes the answer tool twice and forces it where the model accepts that',
      fn: async () => {
        /** Transport replaying one recorded tool call. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        await client.chatText({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: new AbortController().signal,
          responseFormat: RESPONSE_FORMAT,
        },);

        /** Body the client assembled. */
        const body = sentBody({ exchanges, },);

        /** System prompt, which carries the schema a second time. */
        const { system, } = body;

        expect(body.tool_choice,).toEqual({ type: 'tool', name: 'cat_verdict', },);
        expect((typeof system) === 'string',).toBe(true,);
        // THE OWNER'S INSTRUCTION: the full tool schema goes into the system
        // prompt too, because some model and provider pairs emit wrong tool
        // call formats without one.
        expect(String(system,).includes('cat_verdict',),).toBe(true,);
        expect(String(system,).includes('"verdict"',),).toBe(true,);
        // The instruction the caller wrote survives beside the protocol note.
        expect(String(system,).includes('你是一只认真的猫。',),).toBe(true,);
      },
    },),

    it({
      name: 'holds the ask to the lower of the measured bound and the model ceiling',
      fn: async () => {
        /** Transport replaying one recorded tool call. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        await client.chatText({
          modelId: 'hf:openai/gpt-oss-120b',
          messages: MESSAGES,
          signal: new AbortController().signal,
          maxTokens: 1_000_000,
        },);

        // This model stops at 13107, well under the 32000 measured bound, and
        // a request for more buys a truncation reported as a schema mismatch.
        expect(sentBody({ exchanges, },).max_tokens,).toBe(13_107,);
      },
    },),

    it({
      name: 'REFUSES a roster model this provider does not serve, without calling out',
      fn: async () => {
        /** Transport that must not be reached. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        /** Failure the misrouted call produced. */
        let caught: unknown;

        try {
          await client.chatText({
            // Every current roster model now has a Hyper route (glm-5.3-flash
            // joined 2026-09-01), so the unserved case is an invented id cast
            // through the closed union: the guard is against future drift, and
            // drift arrives exactly as a string the union no longer covers.
            modelId: 'hf:cats/Uncatalogued-Cat' as RosterModelId,
            messages: MESSAGES,
            signal: new AbortController().signal,
          },);
        } catch (error) {
          caught = error;
        }

        expect(caught instanceof ModelNotServedError,).toBe(true,);
        // A routing mistake never spends a call.
        expect(exchanges.length,).toBe(0,);
      },
    },),

    it({
      name: 'raises the shared http failure class so existing status readers keep working',
      fn: async () => {
        /** Transport replaying a rate-limit refusal. */
        const { transport, } = recordedTransport({
          replies: [{ status: 429, bodyText: 'out of credits', },],
        },);
        /** Client under test with injected transport and no retry wait. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
          retryPolicy: { limit: 0, baseMs: 1, },
        },);
        /** Failure the refused call produced. */
        let caught: unknown;

        try {
          await client.chatText({
            modelId: 'minimax-m3',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },);
        } catch (error) {
          caught = error;
        }

        expect(caught instanceof SyntheticHttpError,).toBe(true,);
        expect(
          caught instanceof SyntheticHttpError
            ? caught.status
            : 0,
        ).toBe(429,);
      },
    },),

    it({
      name: 'REFUSES a stream that ended without its terminator, after spending every attempt',
      fn: async () => {
        /** Transport replaying a body cut off before `message_stop`. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: CUT_TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport and no retry wait. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
          retryPolicy: { limit: 2, baseMs: 1, },
        },);
        /** Failure the truncated stream produced. */
        let caught: unknown;

        try {
          await client.chatText({
            modelId: 'minimax-m3',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },);
        } catch (error) {
          caught = error;
        }

        // A truncated prefix handed to a validator reports as a schema
        // mismatch, which sends a reader to the prompt rather than to the
        // transport failure this actually is.
        expect(caught instanceof MalformedCompletionError,).toBe(true,);
        // THE FIRST ATTEMPT PLUS BOTH RETRIES. A provider that cuts a stream
        // still answers HTTP 200, so this count is what `#228` changed: the
        // ladder used to return after one call, and the voice was simply lost.
        expect(exchanges.length,).toBe(3,);
      },
    },),

    it({
      name: 'ACCEPTS the retry when only the first attempt was cut short',
      fn: async () => {
        /** Transport cutting the first stream and completing the second. */
        const { transport, exchanges, } = recordedTransport({
          replies: [
            { status: 200, bodyText: CUT_TOOL_CALL_BODY, },
            { status: 200, bodyText: TOOL_CALL_BODY, },
          ],
        },);
        /** Client under test with injected transport and no retry wait. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
          retryPolicy: { limit: 2, baseMs: 1, },
        },);

        /** Answer the second attempt carried. */
        const reply = await client.chatText({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: new AbortController().signal,
        },);

        expect(reply.text,).toBe('{"verdict":"pass"}',);
        // EXACTLY TWO: the cut one and the whole one. A third would say a whole
        // body is being retried too, which would double the cost of every call.
        expect(exchanges.length,).toBe(2,);
      },
    },),

    it({
      name: 'reads a tool call as the answer and admits it through the guard',
      fn: async () => {
        /** Transport replaying one recorded tool call. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: TOOL_CALL_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        /** Outcome of one schema-validated exchange. */
        const outcome = await client.chatJson({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: new AbortController().signal,
          responseFormat: RESPONSE_FORMAT,
          validate: isCatVerdict,
        },);

        expect(outcome.kind,).toBe('ok',);
        expect(
          outcome.kind === 'ok'
            ? outcome.value
            : undefined,
        ).toEqual({ verdict: 'pass', },);
      },
    },),

    it({
      name: 'returns a guard rejection as data rather than raising',
      fn: async () => {
        /** Transport replaying a tool call the guard will not admit. */
        const { transport, } = recordedTransport({
          replies: [{
            status: 200,
            bodyText: messagesBody({ fragments: ['{"verdict":7}',], },),
          },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        /** Outcome of one schema-validated exchange. */
        const outcome = await client.chatJson({
          modelId: 'minimax-m3',
          messages: MESSAGES,
          signal: new AbortController().signal,
          responseFormat: RESPONSE_FORMAT,
          validate: isCatVerdict,
        },);

        expect(outcome.kind,).toBe('schema-mismatch',);
      },
    },),

    it({
      name: 'reads the balance off the credits endpoint',
      fn: async () => {
        /** Transport replaying one recorded balance. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: '{"balance":243}', },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        /** Balance the provider reported. */
        const credits = await client.credits({ signal: new AbortController().signal, },);

        expect(credits,).toEqual({ balance: 243, },);
        expect(exchanges.at(0,)?.url,).toBe(HYPER_CREDITS_URL,);
        expect(exchanges.at(0,)?.method,).toBe('GET',);
        expect(exchanges.at(0,)?.bodyJson,).toBe(undefined,);
      },
    },),

    it({
      name: 'REFUSES a balance body that does not carry a number',
      fn: async () => {
        /** Transport replaying a contract-violating balance. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: '{"balance":"lots"}', },],
        },);
        /** Client under test with injected transport. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);
        /** Failure the malformed balance produced. */
        let caught: unknown;

        try {
          await client.credits({ signal: new AbortController().signal, },);
        } catch (error) {
          caught = error;
        }

        expect(caught instanceof CreditsShapeError,).toBe(true,);
      },
    },),

    it({
      name: 'lets calls to one model overlap, as this provider was measured to allow',
      fn: async () => {
        /** Calls in flight right now. */
        let inFlight = 0;

        /** Most that were ever in flight at once. */
        let widest = 0;

        /**
         * Transport holding each call long enough for overlap to be visible.
         *
         * @returns One recorded tool call, after the hold
         *
         * @example
         * ```ts
         * const reply = await transport();
         * ```
         */
        async function transport(): Promise<{ status: number; bodyText: string; }> {
          inFlight += 1;
          widest = Math.max(
            widest,
            inFlight,
          );
          await wait(SLOW_TRANSPORT_MS,);
          inFlight -= 1;
          return {
            status: 200,
            bodyText: TOOL_CALL_BODY,
          };
        }

        expect(HYPER_PER_MODEL_CONCURRENCY,).toBe(Number.POSITIVE_INFINITY,);

        /** Client under test on its own default width. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
        },);

        await Promise.all(Array.from(
          { length: OVERLAPPING_CALLS, },
          async function one(): Promise<unknown> {
            return await client.chatText({
              modelId: 'minimax-m3',
              messages: MESSAGES,
              signal: new AbortController().signal,
            },);
          },
        ),);

        // OWNER-CONFIRMED UNBOUNDED, with width 64 measured live on
        // 2026-08-30. One call beyond that measured arm proves the production
        // default does not turn the observed width into an artificial ceiling.
        expect(widest,).toBe(OVERLAPPING_CALLS,);
      },
    },),

    it({
      name: 'honors injected finite Hyper width without changing production default',
      fn: async () => {
        /** Gate holding transport calls until overlap is observed. */
        const gate = Promise.withResolvers<void>();
        /** Calls inside transport now. */
        let inFlight = 0;
        /** Widest observed transport overlap. */
        let widest = 0;

        /**
         * Transport whose gate exposes limiter width.
         *
         * @returns Recorded completion after gate opens
         *
         * @example
         * ```ts
         * await transport();
         * ```
         */
        async function transport(): Promise<TransportReply> {
          inFlight += 1;
          widest = Math.max(widest, inFlight,);
          await gate.promise;
          inFlight -= 1;
          return { status: 200, bodyText: TOOL_CALL_BODY, };
        }

        /** Client with deliberately finite injected width. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
          perModelConcurrency: FINITE_TEST_WIDTH,
        },);
        /** One more call than injected width. */
        const calls = Array.from(
          { length: FINITE_TEST_WIDTH + 1, },
          function callModel() {
            return client.chatText({
              modelId: 'minimax-m3',
              messages: MESSAGES,
              signal: new AbortController().signal,
            },);
          },
        );
        await wait(SLOW_TRANSPORT_MS,);

        expect(widest,).toBe(FINITE_TEST_WIDTH,);
        gate.resolve();
        await Promise.all(calls,);
      },
    },),

    it({
      name: 'REFUSES a non-success status from the credits endpoint',
      fn: async () => {
        /** Transport replaying an unauthorized balance read. */
        const { transport, } = recordedTransport({
          replies: [{ status: 401, bodyText: 'missing authorization', },],
        },);
        /** Client under test with injected transport and no retry wait. */
        const client = createHyperClient({
          apiKey: 'test-key',
          transport,
          retryPolicy: { limit: 0, baseMs: 1, },
        },);
        /** Failure the refused read produced. */
        let caught: unknown;

        try {
          await client.credits({ signal: new AbortController().signal, },);
        } catch (error) {
          caught = error;
        }

        expect(caught instanceof SyntheticHttpError,).toBe(true,);
      },
    },),
  ],
},);
