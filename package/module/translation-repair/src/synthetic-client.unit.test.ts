/**
 * Tests for the injected-transport Synthetic client:
 * request construction, contract enforcement, outcome-as-data JSON handling,
 * and per-model concurrency bounds.
 *
 * @module
 */

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import {
  createSyntheticClient,
  isJsonRecord,
  MalformedCompletionError,
  type ModelTransport,
  stripCodeFence,
  stripThinkBlock,
  SyntheticHttpError,
  type TransportExchange,
  type TransportReply,
} from '../dist/final/neutral/index.mjs';

/**
 * Milliseconds granted for queued microtasks and limiter slots to settle.
 */
const SETTLE_MS = 10;

/**
 * Delay of the deliberately slow test transport.
 */
const SLOW_TRANSPORT_MS = 150;

/**
 * Headroom granted past one slow-transport delay:
 * enough for one exchange, far short of queue wait plus exchange.
 */
const DEADLINE_MARGIN_MS = 70;

/**
 * Single user message reused across exchanges.
 */
const MESSAGES = [
  {
    role: 'user' as const,
    content: '猫猫的翻译对吗？',
  },
];

/**
 * Builds a drained SSE body from content deltas plus optional refusal deltas
 * and usage, terminated like the provider terminates streams.
 *
 * @param deltas - content deltas in arrival order
 *
 * @param refusalDeltas - refusal deltas in arrival order
 *
 * @param usage - usage block delivered as the final data event
 *
 * @returns Whole `text/event-stream` body as the transport drains it
 *
 * @example
 * ```ts
 * const body = sseBody({ deltas: ['{"a":', '1}',], },);
 * ```
 */
function sseBody(
  {
    deltas,
    refusalDeltas = [],
    usage,
  }: {
    readonly deltas: readonly string[];
    readonly refusalDeltas?: readonly string[];
    readonly usage?: {
      readonly prompt_tokens: number;
      readonly completion_tokens: number;
    };
  },
): string {
  /**
   * Serialized data events in stream order.
   */
  const events = [
    ...deltas.map(function toContentEvent(delta,) {
      return JSON.stringify({ choices: [{ delta: { content: delta, }, },], },);
    },),
    ...refusalDeltas.map(function toRefusalEvent(delta,) {
      return JSON.stringify({ choices: [{ delta: { refusal: delta, }, },], },);
    },),
    ...(usage === undefined
      ? []
      : [JSON.stringify({ choices: [], usage, },),]),
  ];
  return [
    ...events.map(function toDataLine(event,) {
      return `data: ${event}`;
    },),
    'data: [DONE]',
    '',
  ].join('\n\n',);
}

/**
 * Recorded streamed completion carrying JSON content split across deltas
 * plus usage.
 */
const COMPLETION_BODY = sseBody({
  deltas: [
    '{"verdict":',
    '"pass"}',
  ],
  usage: {
    prompt_tokens: 12,
    completion_tokens: 3,
  },
},);

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

await describe({
  name: stripCodeFence.name,
  children: [
    it({
      name: 'unwraps fenced JSON with a language tag',
      fn: async () => {
        expect(stripCodeFence({ text: '```json\n{"a":1}\n```', },),).toBe('{"a":1}',);
      },
    },),

    it({
      name: 'returns unfenced and unterminated content trimmed',
      fn: async () => {
        expect(stripCodeFence({ text: '  {"a":1}\n', },),).toBe('{"a":1}',);
        expect(stripCodeFence({ text: '```json\n{"a":1}', },),).toBe('```json\n{"a":1}',);
      },
    },),
  ],
},);

await describe({
  name: stripThinkBlock.name,
  children: [
    it({
      name: 'splits the answer off an embedded thinking block',
      fn: async () => {
        expect(stripThinkBlock({ text: '<think>猫喜欢晒太阳吗？是的。</think>\n{"a":1}', },),)
          .toEqual({ answer: '\n{"a":1}', truncatedThinking: false, },);
      },
    },),

    it({
      name: 'passes content without a thinking block through untouched',
      fn: async () => {
        expect(stripThinkBlock({ text: '{"a":1}', },),)
          .toEqual({ answer: '{"a":1}', truncatedThinking: false, },);
      },
    },),

    it({
      name: 'reports truncation when thinking never closes',
      fn: async () => {
        expect(stripThinkBlock({ text: '<think>还在想猫的事情', },),)
          .toEqual({ answer: '', truncatedThinking: true, },);
      },
    },),
  ],
},);

await describe({
  name: createSyntheticClient.name,
  children: [
    it({
      name: 'sends auth, model, and knobs, returning content and usage',
      fn: async () => {
        /** Transport replaying one recorded completion. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: COMPLETION_BODY, },],
        },);
        /** Client under test with injected transport. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport,
        },);
        /** Reply of one exchange with every knob set. */
        const reply = await client.chatText({
          modelId: 'hf:zai-org/GLM-4.7-Flash',
          messages: MESSAGES,
          signal: new AbortController().signal,
          maxTokens: 2_048,
          responseFormat: {
            type: 'json_schema',
            json_schema: { name: 'cat_verdict', schema: { type: 'object', }, },
          },
        },);

        expect(reply.text,).toBe('{"verdict":"pass"}',);
        expect(reply.usage,).toEqual({ prompt_tokens: 12, completion_tokens: 3, },);
        expect(exchanges,).toHaveLength(1,);
        expect(exchanges[0]?.url,)
          .toBe('https://api.synthetic.new/openai/v1/chat/completions',);
        expect(exchanges[0]?.headers.Authorization,).toBe('Bearer test-key',);

        /** Request body decoded for knob assertions. */
        const body: unknown = JSON.parse(exchanges[0]?.bodyJson ?? '{}',);
        expect(isJsonRecord(body,) ? body.model : '',).toBe('hf:zai-org/GLM-4.7-Flash',);
        expect(isJsonRecord(body,) ? body.stream : false,).toBe(true,);
        expect(isJsonRecord(body,) ? body.max_tokens : 0,).toBe(2_048,);
        // The serving stack does not honor sampling knobs reliably;
        // no call may carry one.
        expect(isJsonRecord(body,) && ('temperature' in body),).toBe(false,);

        /** Structured-output block decoded from the request body. */
        const responseFormat = isJsonRecord(body,)
          ? body.response_format
          : '';
        expect(
          isJsonRecord(responseFormat,)
            ? responseFormat.type
            : '',
        ).toBe('json_schema',);
      },
    },),

    it({
      name: 'omits usage when the server omits or mistypes it',
      fn: async () => {
        /** Streamed body without a usage event. */
        const bare = sseBody({ deltas: ['喵',], },);
        /** Streamed body whose usage counts are strings. */
        const mistyped = 'data: {"choices":[{"delta":{"content":"喵"}}]}\n\n'
          + 'data: {"choices":[],"usage":{"prompt_tokens":"12","completion_tokens":"3"}}\n\n'
          + 'data: [DONE]\n';
        /** Transport replaying both defective-usage bodies. */
        const { transport, } = recordedTransport({
          replies: [
            { status: 200, bodyText: bare, },
            { status: 200, bodyText: mistyped, },
          ],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);

        expect(
          (await client.chatText({
            modelId: 'hf:zai-org/GLM-4.7-Flash',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },)).usage,
        ).toBe(undefined,);
        expect(
          (await client.chatText({
            modelId: 'hf:zai-org/GLM-4.7-Flash',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },)).usage,
        ).toBe(undefined,);
      },
    },),

    it({
      name: 'throws SyntheticHttpError once transient retries exhaust',
      fn: async () => {
        /** Transport replaying an endless throttle; retries then throws. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 429, bodyText: '{"error":"slow down"}', },],
        },);
        /** Client under test, on a tiny test backoff. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport,
          retryPolicy: { limit: 2, baseMs: 20, },
        },);
        /** Value caught from the throttled exchange. */
        let caught: unknown;
        try {
          await client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof SyntheticHttpError,).toBe(true,);
        expect(
          caught instanceof SyntheticHttpError
            ? caught.status
            : 0,
        ).toBe(429,);
        // First attempt plus two transient retries.
        expect(exchanges,).toHaveLength(3,);
      },
    },),

    it({
      name: 'retries transient 502s and succeeds on a later attempt',
      fn: async () => {
        /** Transport failing once with 502, then succeeding. */
        const { transport, exchanges, } = recordedTransport({
          replies: [
            { status: 502, bodyText: 'bad gateway', },
            { status: 200, bodyText: COMPLETION_BODY, },
          ],
        },);
        /** Client under test, on a tiny test backoff. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport,
          retryPolicy: { limit: 2, baseMs: 20, },
        },);
        /** Reply that survived one transient failure. */
        const reply = await client.chatText({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: new AbortController().signal,
        },);
        expect(reply.text,).toBe('{"verdict":"pass"}',);
        expect(exchanges,).toHaveLength(2,);
      },
    },),

    it({
      name: 'does not retry non-transient failures',
      fn: async () => {
        /** Transport replaying a permanent client error. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 400, bodyText: '{"error":"bad request"}', },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Value caught from the rejected exchange. */
        let caught: unknown;
        try {
          await client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(
          caught instanceof SyntheticHttpError
            ? caught.status
            : 0,
        ).toBe(400,);
        expect(exchanges,).toHaveLength(1,);
      },
    },),

    it({
      name: 'arms the exchange deadline inside the slot, not at dispatch',
      fn: async () => {
        /**
         * Transport answering after a fixed delay.
         *
         * @param exchange - request under attempt
         *
         * @returns Success reply after the delay
         *
         * @example
         * ```ts
         * await slowReply(exchange,);
         * ```
         */
        async function slowReply(
          exchange: ForeignBorrowed<TransportExchange>,
        ): Promise<TransportReply> {
          // The exchange signal is unused: this transport never hangs.
          void exchange;
          await wait(SLOW_TRANSPORT_MS,);
          return { status: 200, bodyText: COMPLETION_BODY, };
        }

        /** Client with one slot so the second call queues locally. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport: slowReply,
          perModelConcurrency: 1,
        },);
        /**
         * Two same-model calls race for one slot; the second waits a full
         * transport delay in the queue, then needs another full delay for
         * its own exchange. Its deadline covers one delay but not two, so
         * it only survives when the deadline excludes queue wait.
         */
        const replies = await Promise.all([
          client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },),
          client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
            exchangeTimeoutMs: SLOW_TRANSPORT_MS + DEADLINE_MARGIN_MS,
          },),
        ],);
        expect(replies[0]?.text,).toBe('{"verdict":"pass"}',);
        expect(replies[1]?.text,).toBe('{"verdict":"pass"}',);
      },
    },),

    it({
      name: 'forfeits a hung exchange to its deadline',
      fn: async () => {
        /**
         * Transport that never answers, rejecting only on abort.
         *
         * @param exchange - request left hanging
         *
         * @returns Never resolves; rejects with the abort reason
         *
         * @example
         * ```ts
         * await hangForever(exchange,);
         * ```
         */
        async function hangForever(
          exchange: ForeignBorrowed<TransportExchange>,
        ): Promise<TransportReply> {
          /** Gate rejected by the exchange signal's abort reason. */
          const gate = Promise.withResolvers<TransportReply>();
          exchange.signal.addEventListener(
            'abort',
            function onAbort() {
              gate.reject(exchange.signal.reason,);
            },
          );
          return gate.promise;
        }

        /** Client under test. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport: hangForever,
        },);
        /** Value caught from the forfeited exchange. */
        let caught: unknown;
        try {
          await client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
            exchangeTimeoutMs: 50,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(String(caught,),).toContain('Timeout',);
        expect(String(caught,),).toContain('hf:zai-org/GLM-5.2',);
      },
    },),

    it({
      name: 'retries thrown transport failures and succeeds later',
      fn: async () => {
        /** Every exchange the client attempted, in order. */
        const exchanges: TransportExchange[] = [];

        /**
         * Transport dropping its first exchange like a mid-stream reset.
         *
         * @param exchange - request under attempt
         *
         * @returns Success reply from the second attempt on
         *
         * @example
         * ```ts
         * await dropOnce(exchange,);
         * ```
         */
        async function dropOnce(exchange: TransportExchange,): Promise<TransportReply> {
          exchanges.push(exchange,);
          if (exchanges.length === 1)
            throw new TypeError('fetch failed: connection reset',);
          return { status: 200, bodyText: COMPLETION_BODY, };
        }

        /** Client under test, on a tiny test backoff. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport: dropOnce,
          retryPolicy: { limit: 2, baseMs: 20, },
        },);
        /** Reply that survived one dropped connection. */
        const reply = await client.chatText({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: new AbortController().signal,
        },);
        expect(reply.text,).toBe('{"verdict":"pass"}',);
        expect(exchanges,).toHaveLength(2,);
      },
    },),

    it({
      name: 'rethrows thrown transport failures once retries exhaust',
      fn: async () => {
        /** Every exchange the client attempted, in order. */
        const exchanges: TransportExchange[] = [];
        /** Failure thrown on every attempt; identity must survive. */
        const failure = new TypeError('fetch failed: connection reset',);

        /**
         * Transport dropping every exchange.
         *
         * @param exchange - request under attempt
         *
         * @returns Never; every attempt throws
         *
         * @example
         * ```ts
         * await dropAlways(exchange,);
         * ```
         */
        async function dropAlways(exchange: TransportExchange,): Promise<TransportReply> {
          exchanges.push(exchange,);
          throw failure;
        }

        /** Client under test, on a tiny test backoff. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport: dropAlways,
          retryPolicy: { limit: 2, baseMs: 20, },
        },);
        /** Value caught once retries exhausted. */
        let caught: unknown;
        try {
          await client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(failure,);
        // First attempt plus two transient retries.
        expect(exchanges,).toHaveLength(3,);
      },
    },),

    it({
      name: 'propagates thrown failures untouched after caller abort',
      fn: async () => {
        /** Every exchange the client attempted, in order. */
        const exchanges: TransportExchange[] = [];
        /** Failure the aborted stream throws; identity must survive. */
        const failure = new Error('stream torn down by abort',);

        /**
         * Transport whose exchange dies under an aborted signal.
         *
         * @param exchange - request under attempt
         *
         * @returns Never; the aborted stream always throws
         *
         * @example
         * ```ts
         * await tornDown(exchange,);
         * ```
         */
        async function tornDown(exchange: TransportExchange,): Promise<TransportReply> {
          exchanges.push(exchange,);
          throw failure;
        }

        /** Client under test. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport: tornDown,
          retryPolicy: { limit: 2, baseMs: 20, },
        },);
        /** Controller aborted before the exchange settles. */
        const aborted = new AbortController();
        aborted.abort(new Error('user stop',),);
        /** Value caught from the aborted exchange. */
        let caught: unknown;
        try {
          await client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: aborted.signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBe(failure,);
        // Abort means steering: no retry may follow.
        expect(exchanges,).toHaveLength(1,);
      },
    },),

    it({
      name: 'throws MalformedCompletionError on contract-violating success bodies',
      fn: async () => {
        /** Transport replaying a success status without choices. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: '{"unexpected":true}', },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Value caught from the malformed exchange. */
        let caught: unknown;
        try {
          await client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof MalformedCompletionError,).toBe(true,);
      },
    },),

    it({
      name: 'passes the caller signal through to the transport untouched',
      fn: async () => {
        /** Transport recording the exchange for signal identity. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: COMPLETION_BODY, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Controller whose signal identity must survive the plumbing. */
        const controller = new AbortController();
        await client.chatText({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: controller.signal,
        },);
        expect(exchanges[0]?.signal,).toBe(controller.signal,);
      },
    },),

    it({
      name: 'serializes same-model calls and parallelizes cross-model calls',
      fn: async () => {
        /** Gate holding every transport call open until released. */
        const gate = Promise.withResolvers<void>();
        /** Models observed entering the transport, in order. */
        const entered: string[] = [];

        /**
         * Transport that records entry then waits for the gate.
         *
         * @param exchange - request whose model gets recorded
         *
         * @returns Recorded completion once the gate opens
         *
         * @example
         * ```ts
         * const client = createSyntheticClient({ apiKey: 'test-key', transport: gatedTransport, },);
         * ```
         */
        async function gatedTransport(
          exchange: TransportExchange,
        ): Promise<TransportReply> {
          /** Request body decoded to name the entering model. */
          const body: unknown = JSON.parse(exchange.bodyJson ?? '{}',);
          entered.push(String(isJsonRecord(body,) ? body.model : 'unknown',),);
          await gate.promise;
          return { status: 200, bodyText: COMPLETION_BODY, };
        }
        /** Client under test. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport: gatedTransport,
        },);

        /** Two same-model calls plus one cross-model call, all in flight. */
        const inFlight = [
          client.chatText({
            modelId: 'hf:zai-org/GLM-4.7-Flash',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },),
          client.chatText({
            modelId: 'hf:zai-org/GLM-4.7-Flash',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },),
          client.chatText({
            modelId: 'hf:zai-org/GLM-5.2',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },),
        ];
        await wait(SETTLE_MS,);

        // First Flash call and the GLM-5.2 call run; second Flash call is queued.
        expect(entered,).toEqual([
          'hf:zai-org/GLM-4.7-Flash',
          'hf:zai-org/GLM-5.2',
        ],);

        gate.resolve();
        await Promise.all(inFlight,);
        expect(entered,).toHaveLength(3,);
      },
    },),

    it({
      name: 'widens same-model concurrency to perModelConcurrency slots',
      fn: async () => {
        /** Gate holding every transport call open until released. */
        const gate = Promise.withResolvers<void>();
        /** Count of calls observed entering the transport. */
        const entered: string[] = [];

        /**
         * Transport that records entry then waits for the gate.
         *
         * @param exchange - request whose model gets recorded
         *
         * @returns Recorded completion once the gate opens
         *
         * @example
         * ```ts
         * const client = createSyntheticClient({ apiKey: 'test-key', transport: gatedTransport, },);
         * ```
         */
        async function gatedTransport(
          exchange: TransportExchange,
        ): Promise<TransportReply> {
          /** Request body decoded to name the entering model. */
          const body: unknown = JSON.parse(exchange.bodyJson ?? '{}',);
          entered.push(String(isJsonRecord(body,) ? body.model : 'unknown',),);
          await gate.promise;
          return { status: 200, bodyText: COMPLETION_BODY, };
        }
        /** Client granted two slots per model, like a two-pack account. */
        const client = createSyntheticClient({
          apiKey: 'test-key',
          transport: gatedTransport,
          perModelConcurrency: 2,
        },);

        /** Three same-model calls in flight against two slots. */
        const inFlight = [
          client.chatText({
            modelId: 'hf:zai-org/GLM-4.7-Flash',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },),
          client.chatText({
            modelId: 'hf:zai-org/GLM-4.7-Flash',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },),
          client.chatText({
            modelId: 'hf:zai-org/GLM-4.7-Flash',
            messages: MESSAGES,
            signal: new AbortController().signal,
          },),
        ];
        await wait(SETTLE_MS,);

        // Two slots admit two calls at once; the third queues until release.
        expect(entered,).toHaveLength(2,);

        gate.resolve();
        await Promise.all(inFlight,);
        expect(entered,).toHaveLength(3,);
      },
    },),

    it({
      name: 'returns ok with typed value for fenced schema-valid content',
      fn: async () => {
        /** Streamed body whose content wraps valid JSON in a code fence. */
        const fenced = sseBody({ deltas: ['```json\n{"verdict":"pass"}\n```',], },);
        /** Transport replaying the fenced completion. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: fenced, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Outcome of the schema-validated exchange. */
        const outcome = await client.chatJson({
          modelId: 'hf:Qwen/Qwen3.6-27B',
          messages: MESSAGES,
          signal: new AbortController().signal,
          validate: isCatVerdict,
        },);
        expect(outcome.kind,).toBe('ok',);
        expect(
          outcome.kind === 'ok'
            ? outcome.value.verdict
            : '',
        ).toBe('pass',);
      },
    },),

    it({
      name: 'admits think-wrapped JSON and ignores refusal phrasing inside thinking',
      fn: async () => {
        /** Streamed body deliberating about refusing, then answering validly. */
        const deliberated = sseBody({
          deltas: [
            '<think>Should I say i cannot help? No, the request is benign.</think>\n',
            '```json\n{"verdict":"pass"}\n```',
          ],
          usage: {
            prompt_tokens: 40,
            completion_tokens: 900,
          },
        },);
        /** Transport replaying the deliberated completion. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: deliberated, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Outcome of the deliberated exchange. */
        const outcome = await client.chatJson({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: new AbortController().signal,
          validate: isCatVerdict,
        },);
        expect(outcome.kind,).toBe('ok',);
        expect(
          outcome.kind === 'ok'
            ? outcome.value.verdict
            : '',
        ).toBe('pass',);
        expect(outcome.usage,).toEqual({ prompt_tokens: 40, completion_tokens: 900, },);
      },
    },),

    it({
      name: 'reports truncated thinking as schema-mismatch naming the cause',
      fn: async () => {
        /** Streamed body whose content died inside its thinking block. */
        const truncated = sseBody({ deltas: ['<think>猫的翻译问题很复杂，首先',], },);
        /** Transport replaying the truncated completion. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: truncated, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Outcome of the truncated exchange. */
        const outcome = await client.chatJson({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: new AbortController().signal,
          validate: isCatVerdict,
        },);
        expect(outcome.kind,).toBe('schema-mismatch',);
        expect(
          outcome.kind === 'schema-mismatch'
            ? outcome.detail
            : '',
        ).toContain('thinking',);
      },
    },),

    it({
      name: 'treats the API refusal field as first-class refusal',
      fn: async () => {
        /** Streamed body refusing through refusal deltas with no content. */
        const refusedByApi = sseBody({
          deltas: [],
          refusalDeltas: ['Request declined ', 'by policy.',],
        },);
        /** Transport replaying the API-refused completion. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: refusedByApi, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Outcome of the API-refused exchange. */
        const outcome = await client.chatJson({
          modelId: 'hf:Qwen/Qwen3.6-27B',
          messages: MESSAGES,
          signal: new AbortController().signal,
          validate: isCatVerdict,
        },);
        expect(outcome.kind,).toBe('refusal-shaped',);
        expect(
          outcome.kind === 'refusal-shaped'
            ? outcome.marker
            : '',
        ).toBe('api-refusal-field',);
        expect(
          outcome.kind === 'refusal-shaped'
            ? outcome.rawText
            : '',
        ).toBe('Request declined by policy.',);
      },
    },),

    it({
      name: 'returns refusal-shaped for unparseable apologetic content',
      fn: async () => {
        /** Streamed body whose content is a prose refusal. */
        const refusal = sseBody({
          deltas: ["I'm sorry, but I can't assist with that request.",],
        },);
        /** Transport replaying the refusal completion. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: refusal, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Outcome of the refused exchange. */
        const outcome = await client.chatJson({
          modelId: 'hf:MiniMaxAI/MiniMax-M3',
          messages: MESSAGES,
          signal: new AbortController().signal,
          validate: isCatVerdict,
        },);
        expect(outcome.kind,).toBe('refusal-shaped',);
        // "i can't assist" precedes "i'm sorry, but" in the marker list,
        // and first marker in list order wins.
        expect(
          outcome.kind === 'refusal-shaped'
            ? outcome.marker
            : '',
        ).toBe("i can't assist",);
      },
    },),

    it({
      name: 'returns schema-mismatch for valid JSON the guard rejects',
      fn: async () => {
        /** Streamed body whose content is valid JSON of the wrong shape. */
        const wrongShape = sseBody({ deltas: ['{"verdicts":["pass"]}',], },);
        /** Transport replaying the wrong-shape completion. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: wrongShape, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Outcome of the guard-rejected exchange. */
        const outcome = await client.chatJson({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: new AbortController().signal,
          validate: isCatVerdict,
        },);
        expect(outcome.kind,).toBe('schema-mismatch',);
      },
    },),

    it({
      name: 'returns schema-mismatch for unparseable non-refusal content',
      fn: async () => {
        /** Streamed body whose content is confident prose, not JSON and not refusal. */
        const prose = sseBody({ deltas: ['The translation is excellent overall.',], },);
        /** Transport replaying the prose completion. */
        const { transport, } = recordedTransport({
          replies: [{ status: 200, bodyText: prose, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Outcome of the prose exchange. */
        const outcome = await client.chatJson({
          modelId: 'hf:zai-org/GLM-5.2',
          messages: MESSAGES,
          signal: new AbortController().signal,
          validate: isCatVerdict,
        },);
        expect(outcome.kind,).toBe('schema-mismatch',);
        expect(
          outcome.kind === 'schema-mismatch'
            ? outcome.detail
            : '',
        ).toContain('not valid JSON',);
      },
    },),

    it({
      name: 'reads quota snapshots through the transport',
      fn: async () => {
        /** Recorded quotas body with invented numbers. */
        const quotasBody = JSON.stringify({
          weeklyTokenLimit: {
            nextRegenAt: '2026-07-17T00:10:00.000Z',
            percentRemaining: 87.5,
          },
          rollingFiveHourLimit: {
            nextTickAt: '2026-07-16T22:55:00.000Z',
            tickPercent: 0.05,
            remaining: 613.4,
            max: 640,
            limited: false,
          },
        },);
        /** Transport replaying the quotas body. */
        const { transport, exchanges, } = recordedTransport({
          replies: [{ status: 200, bodyText: quotasBody, },],
        },);
        /** Client under test. */
        const client = createSyntheticClient({ apiKey: 'test-key', transport, },);
        /** Snapshot of the recorded quota state. */
        const snapshot = await client.quotas({ signal: new AbortController().signal, },);
        expect(snapshot.fiveHour.remaining,).toBe(613.4,);
        expect(snapshot.weekly.percentRemaining,).toBe(87.5,);
        expect(exchanges[0]?.url,).toBe('https://api.synthetic.new/v2/quotas',);
        expect(exchanges[0]?.method,).toBe('GET',);
      },
    },),
  ],
},);
