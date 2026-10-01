/** Intercepted native Codex HTTP and finite response packets, never WebSockets. @module */
import type { Provider, } from '@earendil-works/pi-ai';
import { stream as nativeStream, streamSimple as nativeSimple, } from '@earendil-works/pi-ai/api/openai-codex-responses';
import { requireCodexModel, } from './host-fixture-model.ts';
import { fixtureProvider, } from './host-fixture-provider.ts';

//region SSE fixtures: use the installed native parser and complete packet protocol.

/** Create a completed text response accepted by native Codex streaming. */
export function nativeResponse({ text = 'Native fixture answer.', tool = false, }: {
  readonly text?: string;
  readonly tool?: boolean;
} = {},): Response {
  const item = tool
    ? { type: 'function_call', id: 'fc_fixture', call_id: 'call_fixture', name: 'fixture_tool', arguments: '{}', status: 'completed', }
    : { type: 'message', id: 'msg_fixture', role: 'assistant', status: 'completed',
      content: [{ type: 'output_text', text, annotations: [], },], };
  const events = [
    { type: 'response.created', response: { id: 'resp_fixture', }, },
    { type: 'response.output_item.added', output_index: 0, item, },
    { type: 'response.output_item.done', output_index: 0, item, },
    { type: 'response.completed', response: { id: 'resp_fixture', status: 'completed', output: [item,],
      usage: { input_tokens: 10, output_tokens: 2, total_tokens: 12, input_tokens_details: { cached_tokens: 0, }, }, }, },
  ];
  return new Response(events.map(function packet(event) { return `data: ${JSON.stringify(event,)}\n\n`; },).join('',),
    { status: 200, headers: { 'content-type': 'text/event-stream', }, },);
}

/** Deliver native provider failure packets without depending on normalized fake errors. */
export function nativeFailureResponse({ code, message, }: { readonly code: string; readonly message: string; },): Response {
  const event = { type: 'response.failed', response: { id: 'resp_fixture_failed', status: 'failed',
    output: [], error: { code, message, }, }, };
  return new Response(`data: ${JSON.stringify(event,)}\n\n`,
    { status: 200, headers: { 'content-type': 'text/event-stream', }, },);
}

/** Captured final serialized HTTP input, including headers after registry auth resolution. */
export type FixtureHttpCall = { readonly url: string; readonly payload: unknown; readonly headers: Headers; };

/** Create a native provider whose HTTP adapter is bounded and cannot reach a real network. */
export function fixtureHttp({ responses = [() => nativeResponse(), () => nativeResponse(),], }: {
  readonly responses?: readonly (() => Response)[];
} = {},) {
  const source = fixtureProvider({ dynamic: false, },);
  const requests: FixtureHttpCall[] = [];
  /** Injected fetch rejects every non-fixture endpoint and every unexpected extra request. */
  const fetchFixture: typeof globalThis.fetch = async function fetchFixture(input, init) {
    const url = input instanceof Request ? input.url : String(input,);
    if (!url.startsWith('https://host-fixture.invalid/',))
      throw new Error(`Native fixture attempted an unexpected endpoint: ${url}`,);
    if (typeof init?.body !== 'string')
      throw new Error('Native fixture expected a serialized request body.',);
    const respond = responses[requests.length];
    if (respond === undefined)
      throw new Error('Native fixture exceeded its finite response budget.',);
    requests.push({ url, payload: JSON.parse(init.body,), headers: new Headers(init.headers,), },);
    init.signal?.throwIfAborted();
    return respond();
  };
  const provider: Provider = {
    ...source.provider,
    stream: function stream(model, context, options) {
      source.state.calls.push({ kind: 'full', model, context, options, },);
      return nativeStream(requireCodexModel(model,), context,
        { ...options, fetch: fetchFixture, transport: 'sse', maxRetries: 0, },);
    },
    streamSimple: function streamSimple(model, context, options) {
      source.state.calls.push({ kind: 'simple', model, context, options, },);
      return nativeSimple(requireCodexModel(model,), context,
        { ...options, fetch: fetchFixture, transport: 'sse', maxRetries: 0, },);
    },
  };
  return { requests, source: { provider, state: source.state, }, };
}

//endregion SSE fixtures
