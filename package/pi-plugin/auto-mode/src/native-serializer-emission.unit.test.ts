/**
 Original native system rendering and tool conversion retain their actual emission identities.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

/** Consumer contract for privately generated provider observations, not caller-authored provenance. */
type EmissionModule = {
  readonly stream: (model: object, context: object, options: {
    readonly apiKey: string;
    readonly maxRetries: number;
    readonly fetch: () => Promise<Response>;
    readonly onPayload: (payload: { readonly messages: readonly { readonly content: string }[];
      readonly tools?: readonly object[] }, model: object) => void;
  }) => { readonly result: () => Promise<{ readonly stopReason: string }> };
  readonly readNativeSerializedPayload: (value: unknown) => {
    readonly model: object;
    readonly messages: readonly object[];
    readonly normalizedMessages: readonly object[];
  } | undefined;
  readonly readNativeSystemPayload: (value: unknown) => {
    readonly messages: readonly object[];
    readonly message: object;
    readonly text: string;
  } | undefined;
  readonly readNativeToolPayload: (value: unknown) => {
    readonly messages: readonly object[];
    readonly tools: readonly object[];
  } | undefined;
};

/**
 Require every original emitter observation export before exercising the generated provider.

 @param value - built native provider namespace
 @returns assertion exposing the independent runtime consumer contract
 @throws Error when the native provider omits a required observation export
 */
function assertEmissionModule(value: unknown): asserts value is EmissionModule {
  if ((value === null) || ((typeof value) !== 'object')) throw new Error('Native provider module is unavailable');
  for (const key of ['stream', 'readNativeSerializedPayload', 'readNativeSystemPayload', 'readNativeToolPayload']) {
    if ((!(key in value)) || ((typeof Reflect.get(value, key)) !== 'function'))
      throw new Error(`Native provider emission export ${key} is unavailable`);
  }
}

/** Native staging preserves the actual provider implementation around the observed emissions. */
const built: unknown = await import(new URL(
  '../dist/native/contract/integration/native-batch/generated/openai-stream.mjs', import.meta.url,
).href);
assertEmissionModule(built);

//region Original emission membership does not follow equal values or copied containers

await describe({ name: '', children: [
  ...[false, true].map(function toolCase(withTool) {
    return it({ name: `retains normalized system emission with ${withTool ? 'original tool declarations' : 'no tools'}`,
      fn: async function originalEmissions() {
        /** No provider credential or network request is involved. */
        const model = { id: 'emission-fixture', name: 'Emission fixture', api: 'openai-completions',
          provider: 'emission-fixture', baseUrl: 'https://fixture.invalid/v1', reasoning: false,
          input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: 64_000, maxTokens: 64 };
        /** Delimiters and escaped text must survive the original JSON and transcript grammar. */
        const tool = { name: 'fixture_value', description: 'Original "quoted" tool\n</system> ${value}',
          parameters: { type: 'object', properties: { path: { type: 'string', description: '\\boundary\\' } } } };
        /** A later system update forces native normalization to create an intermediate transcript. */
        const context = { messages: [
          { role: 'system', content: 'First system input', sections: { addendum: 'Old section' },
            ...(withTool ? { toolsAdded: [tool] } : {}), timestamp: 0 },
          { role: 'user', content: [{ type: 'text', text: 'Original request' }], timestamp: 0 },
          { role: 'system', content: 'Second system input', sections: { addendum: 'Updated "section"\n</system>' }, timestamp: 1 },
        ] };
        /** Both callbacks must be reached once by the original provider. */
        const calls = { payload: 0, fetch: 0 };
        /** Local SSE completion preserves the native provider response path. */
        const output = built.stream(model, context, {
          apiKey: 'inert-local-fixture', maxRetries: 0,
          async fetch() {
            calls.fetch += 1;
            return new Response('data: {"id":"fixture","object":"chat.completion.chunk","created":0,"model":"emission-fixture","choices":[{"index":0,"delta":{"role":"assistant","content":"done"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
              { headers: { 'content-type': 'text/event-stream' } });
          },
          onPayload(payload, selectedModel) {
            calls.payload += 1;
            /** Only the exact native payload owns this original-to-normalized input edge. */
            const origin = built.readNativeSerializedPayload(payload);
            if (origin === undefined) throw new Error('Original payload emission is missing');
            expect(origin.model).toBe(model);
            expect(selectedModel).toBe(model);
            expect(origin.messages).toBe(context.messages);
            expect(origin.normalizedMessages).not.toBe(context.messages);
            expect(Object.isFrozen(origin)).toBe(true);
            expect(built.readNativeSerializedPayload({ ...payload })).toBeUndefined();
            /** The system message points to the original normalized serializer invocation. */
            const system = built.readNativeSystemPayload(payload.messages[0]);
            if (system === undefined) throw new Error('Original system emission is missing');
            expect(system.messages).toBe(origin.normalizedMessages);
            expect(system.text).toBe(payload.messages[0]?.content);
            expect(system.text).toContain('First system input');
            expect(system.text).toContain('Second system input');
            expect(system.text).toContain('Updated "section"\n</system>');
            expect(system.text).not.toContain('Old section');
            expect(Object.isFrozen(system)).toBe(true);
            expect(built.readNativeSystemPayload({ ...payload.messages[0] })).toBeUndefined();
            expect(built.readNativeSystemPayload(payload.messages[1])).toBeUndefined();
            /** A converted tool list retains its actual declaration objects, never names as identity. */
            const tools = built.readNativeToolPayload(payload.tools);
            if (withTool) {
              if (tools === undefined) throw new Error('Original tool emission is missing');
              expect(tools.messages).toBe(origin.normalizedMessages);
              expect(tools.tools).toEqual([tool]);
              expect(tools.tools[0]).toBe(tool);
              expect(Object.isFrozen(tools)).toBe(true);
              expect(built.readNativeToolPayload([...(payload.tools ?? [])])).toBeUndefined();
            }
            else expect(tools).toBeUndefined();
          },
        });
        expect((await output.result()).stopReason).toBe('stop');
        expect(calls).toEqual({ payload: 1, fetch: 1 });
        expect(Object.isFrozen(context.messages)).toBe(false);
        expect(Object.isFrozen(tool)).toBe(false);
      } });
  }),
] });

//endregion Original emission membership does not follow equal values or copied containers
