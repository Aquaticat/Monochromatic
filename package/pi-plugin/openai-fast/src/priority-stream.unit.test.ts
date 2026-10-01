/**
 Built stream delegation and native Codex request-boundary verification. @module
 */
import { zstdDecompressSync, } from 'node:zlib';
import {
  type Api,
  type AssistantMessageEventStream,
  createAssistantMessageEventStream,
  type Model,
  type OpenAICodexResponsesOptions,
  type ProviderResponse,
  type SimpleStreamOptions,
  type TranscriptContext,
} from '@earendil-works/pi-ai';
import { buildBaseOptions, } from '@earendil-works/pi-ai/api/simple-options';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  PriorityRequestError,
  streamPriority,
  streamSimplePriority,
} from '../dist/final/node/index.mjs';
import {
  createStreamFixtureContext,
  createStreamFixtureModel,
  createStreamFixtureResponse,
  STREAM_FIXTURE_TOKEN,
  StreamFixtureStopError,
} from './stream-fixture.ts';

//region Reasoning cases: match native clamping rather than a fast-model allowlist.

/**
 Native simple reasoning behavior includes off, unrequested, clamped, and supported levels.
 */
const REASONING_CASES: readonly {
  readonly name: string;
  readonly reasoning?: SimpleStreamOptions['reasoning'];
  readonly modelOverrides?: Partial<Model<'openai-codex-responses'>>;
  readonly effort?: OpenAICodexResponsesOptions['reasoningEffort'];
}[] = [
  { name: 'undefined remains unrequested', },
  {
    name: 'runtime off becomes undefined native effort',
    // Native JavaScript callers can provide off even though simple TypeScript options exclude it.
    reasoning: 'off' as unknown as SimpleStreamOptions['reasoning'],
  },
  { name: 'high remains high', reasoning: 'high', effort: 'high', },
  { name: 'high on non-reasoning model clamps to off', reasoning: 'high', modelOverrides: { reasoning: false, }, },
  { name: 'xhigh without support clamps to high', reasoning: 'xhigh', effort: 'high', },
  {
    name: 'supported xhigh remains xhigh', reasoning: 'xhigh',
    modelOverrides: { thinkingLevelMap: { xhigh: 'xhigh', }, }, effort: 'xhigh',
  },
  {
    name: 'unsupported xhigh clamps upward to supported max', reasoning: 'xhigh',
    modelOverrides: { thinkingLevelMap: { xhigh: null, max: 'max', }, }, effort: 'max',
  },
];

//endregion Reasoning cases

await describe({
  name: '',
  children: [
    //region Full options: optional registry dispatch sees native model and all caller capabilities.

    describe({
      name: streamPriority.name,
      children: [
        it({
          name: 'injects full dispatch with original model, context, and all options except composed priority fields',
          fn: async ctx => {
            /** Original model-specific headers belong to the native model, not a routing ID. */
            const model = createStreamFixtureModel({ headers: { 'x-stream-fixture-model': 'original', }, },);
            /** Original transcript identity is passed through. */
            const context = createStreamFixtureContext();
            /** Replacement is caller-owned and not modified in place. */
            const replacement = Object.freeze({ fixture_replacement: true, service_tier: 'default', },);
            /** Caller payload callback retains async replacement semantics. */
            const onPayload = ctx.sinon.spy(async () => await Promise.resolve(replacement,),);
            /** Response instrumentation must not be replaced. */
            const onResponse = ctx.sinon.spy(async () => undefined,);
            /** Provider event instrumentation must not be replaced. */
            const onProviderStreamEvent = ctx.sinon.spy(async () => undefined,);
            /** Complete native options include capabilities ignored by native request serialization. */
            const options: OpenAICodexResponsesOptions = Object.freeze({
              apiKey: 'injected-stream-fixture-key',
              temperature: 0.25,
              maxTokens: 2_048,
              samplingParams: { top_p: 0.5, },
              signal: new AbortController().signal,
              telemetryContext: { startSpan: async () => { throw new StreamFixtureStopError(); }, },
              fetch: ctx.sinon.spy(async () => createStreamFixtureResponse(),),
              env: { STREAM_FIXTURE_ENV: 'preserved', },
              headers: { 'x-stream-fixture-runtime': 'preserved', 'x-remove': null, },
              transport: 'websocket-cached',
              timeoutMs: 1_234,
              websocketConnectTimeoutMs: 2_345,
              maxRetries: 3,
              maxRetryDelayMs: 4_567,
              cacheRetention: 'none',
              sessionId: 'stream-fixture-session',
              metadata: { fixture: 'metadata', },
              reasoningEffort: 'none',
              reasoningSummary: 'detailed',
              textVerbosity: 'high',
              toolChoice: 'required',
              serviceTier: 'flex',
              onPayload,
              onResponse,
              onProviderStreamEvent,
            },);
            /** Injected native stream object must be returned without wrapping. */
            const events = createAssistantMessageEventStream();
            /** Standalone spy does not patch modules, providers, or global state. */
            const stream = ctx.sinon.spy((receivedModel: Model<'openai-codex-responses'>, receivedContext: TranscriptContext, receivedOptions?: OpenAICodexResponsesOptions) => {
              expect(receivedModel,).toBe(model,);
              expect(receivedContext,).toBe(context,);
              expect(receivedOptions?.serviceTier,).toBe('priority',);
              return events;
            },);
            /** Full entry point composes options before injected registry-compatible dispatch. */
            const returned = streamPriority({ model, context, options, stream, },);
            expect(returned,).toBe(events,);
            expect(stream,).toHaveBeenCalledTimes(1,);
            /** Native options are captured without casting the production callback shape. */
            const composed = stream.firstCall.args[2];
            if (composed?.onPayload === undefined)
              throw new Error('Expected composed native payload callback',);
            for (const key of Object.keys(options,) as readonly (keyof OpenAICodexResponsesOptions)[]) {
              if (key !== 'serviceTier' && key !== 'onPayload')
                expect(composed[key],).toBe(options[key],);
            }
            /** Native callback composition retains original payload and model identity. */
            const original = { fixture_native: true, };
            /** Final body receives priority after the caller returns a different tier. */
            const payload = await composed.onPayload(original, model,);
            expect(onPayload,).toHaveBeenCalledExactlyOnceWith(original, model,);
            expect(payload,).toEqual({ fixture_replacement: true, service_tier: 'priority', },);
            expect(replacement.service_tier,).toBe('default',);
            expect(options.serviceTier,).toBe('flex',);
            expect(options.onPayload,).toBe(onPayload,);
          },
        },),
        it({
          name: 'snapshots caller payload callback before deferred registry dispatch',
          fn: async ctx => {
            /** First callback belongs to the request at composition time. */
            const originalCallback = ctx.sinon.spy(async () => ({ original_callback: true, }),);
            /** A later reused options callback must not replace the request callback. */
            const laterCallback = ctx.sinon.spy(async () => ({ later_callback: true, }),);
            /** Mutable host options can be reused after initial composition. */
            const options: OpenAICodexResponsesOptions = { onPayload: originalCallback, };
            /** Real live model remains unchanged across deferred callback invocation. */
            const model = createStreamFixtureModel();
            /** Native-compatible spy captures options without invoking payload customization. */
            const stream = ctx.sinon.spy((receivedModel: Model<'openai-codex-responses'>, context: TranscriptContext, receivedOptions?: OpenAICodexResponsesOptions) => {
              expect(receivedModel,).toBe(model,);
              expect(context.messages,).not.toHaveLength(0,);
              expect(receivedOptions?.serviceTier,).toBe('priority',);
              return createAssistantMessageEventStream();
            },);
            streamPriority({ model, context: createStreamFixtureContext(), options, stream, },);
            options.onPayload = laterCallback;
            /** Deferred native payload callback retains the initially composed caller function. */
            const composed = stream.firstCall.args[2];
            if (composed?.onPayload === undefined)
              throw new Error('Expected deferred composed payload callback',);
            expect(await composed.onPayload({ native: true, }, model,),).toEqual({ original_callback: true, service_tier: 'priority', },);
            expect(originalCallback,).toHaveBeenCalledTimes(1,);
            expect(laterCallback,).not.toHaveBeenCalled();
          },
        },),
        it({
          name: 'composes priority when native caller options are absent',
          fn: async ctx => {
            /** Unconfigured full stream may still be delegated to an injected native implementation. */
            const model = createStreamFixtureModel();
            /** Branded original transcript. */
            const context = createStreamFixtureContext();
            /** Standalone injected stream records options without consuming transport. */
            const stream = ctx.sinon.spy((receivedModel: Model<'openai-codex-responses'>, receivedContext: TranscriptContext, options?: OpenAICodexResponsesOptions) => {
              expect(receivedModel,).toBe(model,);
              expect(receivedContext,).toBe(context,);
              expect(options?.serviceTier,).toBe('priority',);
              return createAssistantMessageEventStream();
            },);
            streamPriority({ model, context, stream, },);
            /** Even absent customization receives a native-compatible priority callback. */
            const composed = stream.firstCall.args[2];
            if (composed?.onPayload === undefined)
              throw new Error('Expected composed payload callback without options',);
            expect(await composed.onPayload({ native: true, }, model,),).toEqual({ native: true, service_tier: 'priority', },);
          },
        },),
      ],
    },),
    //endregion Full options

    //region Simple options: use native base conversion and reasoning before full dispatch.

    describe({
      name: streamSimplePriority.name,
      children: [
        ...REASONING_CASES.map(testCase => it({
          name: testCase.name,
          fn: async ctx => {
            /** Each case uses live model capabilities, not a known-model allowlist. */
            const model = createStreamFixtureModel(testCase.modelOverrides,);
            /** Native option preparation reads the normalized transcript. */
            const context = createStreamFixtureContext();
            /** Result identity proves the full injected stream is used. */
            const events = createAssistantMessageEventStream();
            /** Native-compatible injection observes the final reasoning effort. */
            const stream = ctx.sinon.spy((receivedModel: Model<'openai-codex-responses'>, receivedContext: TranscriptContext, options?: OpenAICodexResponsesOptions) => {
              expect(receivedModel,).toBe(model,);
              expect(receivedContext,).toBe(context,);
              expect(options?.reasoningEffort,).toBe(testCase.effort,);
              expect(options?.serviceTier,).toBe('priority',);
              expect(options?.toolChoice,).toBe('none',);
              return events;
            },);
            expect(streamSimplePriority({
              model, context, stream,
              options: {
                apiKey: 'injected-stream-fixture-key',
                ...(testCase.reasoning === undefined ? {} : { reasoning: testCase.reasoning, }),
                toolChoice: 'none',
              },
            },),).toBe(events,);
            expect(stream,).toHaveBeenCalledTimes(1,);
          },
        },),),
        it({
          name: 'preserves every native base option, instrumentation reference, and native token clamp',
          fn: async ctx => {
            /** Context window forces the native helper to cap an oversized output request. */
            const model = createStreamFixtureModel({ contextWindow: 512, },);
            /** Transcript leaves less than the native safety margin available. */
            const context = createStreamFixtureContext();
            /** Customization identity and async semantics remain caller-owned. */
            const onPayload = ctx.sinon.spy(async () => undefined,);
            /** Native base helper defines which provider-neutral options are forwarded. */
            const options: SimpleStreamOptions = {
              apiKey: 'injected-stream-fixture-key',
              temperature: 0.5,
              maxTokens: 8_192,
              samplingParams: { top_p: 0.25, },
              signal: new AbortController().signal,
              telemetryContext: { startSpan: async () => { throw new StreamFixtureStopError(); }, },
              fetch: ctx.sinon.spy(async () => createStreamFixtureResponse(),),
              env: { STREAM_FIXTURE_ENV: 'preserved', },
              headers: { 'x-stream-fixture': 'preserved', },
              transport: 'sse',
              timeoutMs: 1_234,
              websocketConnectTimeoutMs: 2_345,
              maxRetries: 3,
              maxRetryDelayMs: 4_567,
              cacheRetention: 'long',
              sessionId: 'stream-fixture-session',
              metadata: { fixture: 'metadata', },
              onPayload,
              onResponse: ctx.sinon.spy(async () => undefined,),
              onProviderStreamEvent: ctx.sinon.spy(async () => undefined,),
              toolChoice: 'none',
              reasoning: 'high',
            };
            /** Injectable full dispatcher captures native conversion output. */
            const stream = ctx.sinon.spy((receivedModel: Model<'openai-codex-responses'>, receivedContext: TranscriptContext, composed?: OpenAICodexResponsesOptions) => {
              expect(receivedModel,).toBe(model,);
              expect(receivedContext,).toBe(context,);
              if (composed?.onPayload === undefined)
                throw new Error('Expected native simple callback composition',);
              return createAssistantMessageEventStream();
            },);
            streamSimplePriority({ model, context, options, stream, },);
            /** Compare preserved fields with the installed native helper's contract. */
            const expected = buildBaseOptions(model, context, options, options.apiKey,);
            /** Actual full native options include native-specific priority intent. */
            const composed = stream.firstCall.args[2];
            if (composed?.onPayload === undefined)
              throw new Error('Expected captured native simple options',);
            for (const key of Object.keys(expected,) as readonly (keyof typeof expected)[]) {
              if (key !== 'onPayload')
                expect(composed[key],).toBe(expected[key],);
            }
            expect(composed.maxTokens,).toBe(1,);
            expect(composed.reasoningEffort,).toBe('high',);
            expect(composed.toolChoice,).toBe('none',);
            expect(composed.serviceTier,).toBe('priority',);
            expect(await composed.onPayload({ native: true, }, model,),).toEqual({ native: true, service_tier: 'priority', },);
            expect(onPayload,).toHaveBeenCalledTimes(1,);
            expect(options.maxTokens,).toBe(8_192,);
          },
        },),
        ...([undefined, '',] as const).map(apiKey => it({
          name: `rejects missing ${String(apiKey,)} authentication before injected dispatch`,
          fn: async ctx => {
            ctx.expect.assertions(2,);
            /** Missing auth must not enter even the injected native stream. */
            const stream = ctx.sinon.spy((): AssistantMessageEventStream => createAssistantMessageEventStream(),);
            try {
              streamSimplePriority({
                model: createStreamFixtureModel(), context: createStreamFixtureContext(), stream,
                ...(apiKey === undefined ? {} : { options: { apiKey, }, }),
              },);
            }
            catch (error) {
              ctx.expect(error,).toBeInstanceOf(PriorityRequestError,);
            }
            ctx.expect(stream,).not.toHaveBeenCalled();
          },
        },),),
      ],
    },),
    //endregion Simple options

    //region Native boundary: real native payload building and SSE accounting without network access.

    describe({
      name: 'native Codex request boundary',
      children: [
        ...([streamPriority, streamSimplePriority,] as const).map(entryPoint => it({
          name: `${entryPoint.name} builds priority native payload before callback stops transport`,
          fn: async ctx => {
            /** Original ID intentionally has no known-model compatibility allowlist entry. */
            const model = createStreamFixtureModel({ id: 'future-fixture-codex-model', },);
            /** Real native conversion builds instructions and input from this transcript. */
            const context = createStreamFixtureContext();
            /** No request may reach HTTP when caller customization rejects. */
            const fetch = ctx.sinon.spy(async () => { throw new StreamFixtureStopError(); },);
            /** Explicit stop verifies the actual native request before networking. */
            const stop = new StreamFixtureStopError();
            /** Native callback sees the original model and already-requested priority tier. */
            const onPayload = ctx.sinon.spy(async (payload: unknown, receivedModel: Model<Api>) => {
              expect(receivedModel,).toBe(model,);
              expect(payload,).toMatchObject({
                model: model.id, service_tier: 'priority', stream: true, store: false,
                instructions: 'Stream fixture instructions.', tool_choice: 'none',
              },);
              throw stop;
            },);
            /** Default dependency is the actual installed full native Codex stream. */
            const result = await entryPoint({
              model, context,
              options: { apiKey: STREAM_FIXTURE_TOKEN, transport: 'sse', fetch, onPayload, toolChoice: 'none', },
            },).result();
            expect(onPayload,).toHaveBeenCalledTimes(1,);
            expect(fetch,).not.toHaveBeenCalled();
            expect(result.stopReason,).toBe('error',);
            expect(result.errorMessage,).toContain(stop.message,);
            expect(result.model,).toBe(model.id,);
          },
        },),),
        ...([streamPriority, streamSimplePriority,] as const).map(entryPoint => it({
          name: `${entryPoint.name} rejects invalid caller replacement before native networking`,
          fn: async ctx => {
            /** Valid synthetic authentication reaches payload validation, never HTTP. */
            const model = createStreamFixtureModel();
            /** No global fetch interception or runtime credentials are needed. */
            const fetch = ctx.sinon.spy(async () => { throw new StreamFixtureStopError(); },);
            /** Explicit null is a replacement, not native undefined keep semantics. */
            const onPayload = ctx.sinon.spy(async () => null,);
            /** Native stream converts the custom preparation error to its normal error event result. */
            const result = await entryPoint({
              model, context: createStreamFixtureContext(),
              options: { apiKey: STREAM_FIXTURE_TOKEN, transport: 'sse', fetch, onPayload, },
            },).result();
            expect(result.stopReason,).toBe('error',);
            expect(result.errorMessage,).toContain('Return an object from onPayload',);
            expect(onPayload,).toHaveBeenCalledTimes(1,);
            expect(fetch,).not.toHaveBeenCalled();
          },
        },),),
        ...([streamPriority, streamSimplePriority,] as const).flatMap(entryPoint => ([undefined, 'default',] as const).map(serviceTier => it({
          name: `${entryPoint.name} sends replacement priority and preserves native ${String(serviceTier,)} tier accounting`,
          fn: async ctx => {
            /** Model header overrides and original native accounting rates remain in force. */
            const model = createStreamFixtureModel({
              headers: { 'x-stream-fixture-model': 'original', 'x-stream-fixture-remove': 'remove', },
            },);
            /** Independent native transcript. */
            const context = createStreamFixtureContext();
            /** Replacement retains native fields but tries to lower the service tier. */
            const onPayload = ctx.sinon.spy(async (payload: unknown) => ({
              ...(payload as Readonly<Record<string, unknown>>),
              service_tier: 'flex',
              fixture_replacement: 'observed',
            }),);
            /** Native response callback must receive actual synthetic response headers. */
            const onResponse = ctx.sinon.spy(async (response: ProviderResponse, receivedModel: Model<Api>) => {
              expect(response.status,).toBe(200,);
              expect(receivedModel,).toBe(model,);
            },);
            /** Native provider event observer must remain attached. */
            const onProviderStreamEvent = ctx.sinon.spy(async (data: unknown, receivedModel: Model<Api>) => {
              expect(data,).toHaveProperty('type', 'response.completed',);
              expect(receivedModel,).toBe(model,);
            },);
            /** Interception is per-request, never a shared fetch patch. */
            const fetch = ctx.sinon.spy(async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
              expect(String(input,),).toBe(`${model.baseUrl}/codex/responses`,);
              expect(init?.method,).toBe('POST',);
              /** Actual native headers retain both original-model and runtime caller configuration. */
              const headers = new Headers(init?.headers,);
              expect(headers.get('x-stream-fixture-model',),).toBe('original',);
              expect(headers.get('x-stream-fixture-runtime',),).toBe('runtime',);
              expect(headers.get('x-stream-fixture-remove',),).toBeNull();
              expect(headers.get('session-id',),).toBe('stream-fixture-sse-session',);
              expect(headers.get('authorization',),).toBe(`Bearer ${STREAM_FIXTURE_TOKEN}`,);
              expect(headers.get('chatgpt-account-id',),).toBe('stream-fixture-account',);
              /** Decode native request compression without disabling or replacing native transport logic. */
              const bytes = new Uint8Array(await new Response(init?.body,).arrayBuffer(),);
              /** Node native streaming may compress its request body using zstd. */
              const decoded = headers.get('content-encoding',) === 'zstd' ? zstdDecompressSync(bytes,) : bytes;
              /** Serialized payload must still include priority after caller replacement. */
              const sent: unknown = JSON.parse(new TextDecoder().decode(decoded,),);
              expect(sent,).toMatchObject({ model: model.id, service_tier: 'priority', fixture_replacement: 'observed', },);
              return createStreamFixtureResponse(serviceTier === undefined ? {} : { serviceTier, },);
            },);
            /** Native SSE stream remains entirely local but processes real response events. */
            const result = await entryPoint({
              model, context,
              options: {
                apiKey: STREAM_FIXTURE_TOKEN, transport: 'sse', fetch, onPayload, onResponse, onProviderStreamEvent,
                signal: new AbortController().signal,
                headers: { 'x-stream-fixture-runtime': 'runtime', 'x-stream-fixture-remove': null, },
                cacheRetention: 'long', sessionId: 'stream-fixture-sse-session',
                timeoutMs: 5_000, websocketConnectTimeoutMs: 2_000, maxRetries: 0, maxRetryDelayMs: 5_000,
              },
            },).result();
            expect(result.stopReason,).toBe('stop',);
            expect(result.errorMessage,).toBeUndefined();
            expect(fetch,).toHaveBeenCalledTimes(1,);
            expect(onPayload,).toHaveBeenCalledTimes(1,);
            expect(onResponse,).toHaveBeenCalledTimes(1,);
            expect(onResponse.firstCall.args[1],).toBe(model,);
            expect(onResponse.firstCall.args[0],).toMatchObject({ status: 200, headers: { 'x-stream-fixture-response': 'observed', }, },);
            expect(onProviderStreamEvent,).toHaveBeenCalledTimes(1,);
            expect(onProviderStreamEvent.firstCall.args[1],).toBe(model,);
            expect(onProviderStreamEvent.firstCall.args[0],).toHaveProperty('type', 'response.completed',);
            expect(result.model,).toBe(model.id,);
            expect(result.usage.input,).toBe(90,);
            expect(result.usage.output,).toBe(20,);
            expect(result.usage.cacheRead,).toBe(10,);
            expect(result.usage.cost.input,).toBeCloseTo(0.00018, 10,);
            expect(result.usage.cost.output,).toBeCloseTo(0.00008, 10,);
            expect(result.usage.cost.cacheRead,).toBeCloseTo(0.00001, 10,);
            expect(result.usage.cost.total,).toBeCloseTo(0.00027, 10,);
          },
        },),),),
      ],
    },),
    //endregion Native boundary
  ],
},);
