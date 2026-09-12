import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type BedrockClient,
  capturePreparationProviderRequest,
  type ChatTextReply,
  type ChatTextRequest,
  type ModelCaller,
  preparationCaptureClient,
  PreparationRequestCaptureError,
  type TransportExchange,
} from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'provider-capture-contract-test' });
const request: ChatTextRequest = { modelId: 'hf:Qwen/Qwen3.8-27B', messages: [{ role: 'user', content: 'Cat fixture.' }],
  signal: new AbortController().signal, exchangeTimeoutMs: 5_000 };
const exchange: TransportExchange = { url: 'https://fixture.invalid/model', method: 'POST', label: 'fixture-model-label',
  headers: { authorization: 'Bearer fixture-only-authorization' }, bodyJson: '{"model":"fixture-model","max_tokens":17}', signal: request.signal };

await describe({ name: capturePreparationProviderRequest.name, children: [
  it({ name: 'keeps exact header-free projection and optional transport metadata', fn: async () => {
    const sent = { ...exchange, wireFormat: 'anthropic' as const, maxAnswerChars: 71 };
    const result = await capturePreparationProviderRequest({ provider: 'synthetic', request, l,
      createClient: ({ transport }): ModelCaller => ({
        chatText: async (): Promise<ChatTextReply> => {
          await transport(sent);
          throw new Error('capture transport unexpectedly returned');
        },
        chatJson: (): never => { throw new Error('capture must use text calls'); },
      }),
    });
    expect(result).toEqual({ modelId: request.modelId, provider: 'synthetic', method: 'POST', url: sent.url,
      bodyJson: sent.bodyJson, label: sent.label, wireFormat: 'anthropic', maxAnswerChars: 71 });
    expect(JSON.stringify(result)).not.toContain('authorization');
  } }),
  ...[...['thinking', 'budget_tokens', 'reasoning_effort', 'temperature', 'reasoning', 'effort'].map(key => ({ ...exchange, bodyJson: JSON.stringify({ [key]: 1 }) })),
    { ...exchange, bodyJson: '{invalid' }, { ...exchange, bodyJson: '[]' }, { ...exchange, method: 'GET' as const },
    { url: exchange.url, method: 'POST' as const, label: exchange.label, headers: {}, signal: request.signal }].map((sent, index) => it({
      name: `rejects unsupported native request projection ${index}`, fn: async () => {
        let caught: unknown;
        try {
          await capturePreparationProviderRequest({ provider: 'synthetic', request, l,
            createClient: ({ transport }): ModelCaller => ({
              chatText: async (): Promise<ChatTextReply> => {
                await transport(sent);
                throw new Error('capture transport unexpectedly returned');
              },
              chatJson: (): never => { throw new Error('capture must use text calls'); },
            }),
          });
        }
        catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(PreparationRequestCaptureError);
        expect((caught as PreparationRequestCaptureError).kind).toBe('request');
        expect((caught as Error).message).not.toContain('{invalid');
      },
    })),
  it({ name: 'honors a provider-derived aborted exchange signal even while the caller signal remains live', fn: async () => {
    const reason = new Error('provider-derived deadline fixture');
    const sent = { ...exchange, signal: AbortSignal.abort(reason) };
    let caught: unknown;
    try {
      await capturePreparationProviderRequest({ provider: 'synthetic', request, l,
        createClient: ({ transport }): ModelCaller => ({
          chatText: async (): Promise<ChatTextReply> => {
            await transport(sent);
            throw new Error('capture transport unexpectedly returned');
          },
          chatJson: (): never => { throw new Error('capture must use text calls'); },
        }),
      });
    }
    catch (error) { caught = error; }
    expect(request.signal.aborted).toBe(false);
    expect(caught).toBe(reason);
  } }),
  ...['return', 'swallow', 'twice'].map(mode => it({ name: `refuses client flow ${mode} without one escaped identity-compared stop`, fn: async () => {
    const swallowed: unknown[] = [];
    let caught: unknown;
    try {
      await capturePreparationProviderRequest({ provider: 'synthetic', request, l,
        createClient: ({ transport }): ModelCaller => ({
          chatText: async (): Promise<ChatTextReply> => {
            if (mode === 'return') return { text: 'no request happened' };
            try {
              await transport(exchange);
            }
            catch (error) { swallowed.push(error); }
            if (mode === 'twice') await transport(exchange);
            return { text: 'native client incorrectly swallowed capture stop' };
          },
          chatJson: (): never => { throw new Error('capture must use text calls'); },
        }),
      });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRequestCaptureError);
    expect((caught as PreparationRequestCaptureError).kind).toBe('no-capture');
    expect(swallowed).toHaveLength(mode === 'return' ? 0 : 1);
  } })),
  it({ name: 'does not replace an unexpected native client failure with successful capture', fn: async () => {
    const reason = new Error('native construction failure fixture');
    let caught: unknown;
    try {
      await capturePreparationProviderRequest({ provider: 'synthetic', request, l,
        createClient: (): ModelCaller => ({ chatText: (): never => { throw reason; }, chatJson: (): never => { throw reason; } }),
      });
    }
    catch (error) { caught = error; }
    expect(caught).toBe(reason);
  } }),
  it({ name: 'refuses native Bedrock credit reads instead of inspecting account state', fn: async () => {
    const client = preparationCaptureClient({ provider: 'bedrock', transport: (): never => { throw new Error('credit read must not reach transport'); } }) as BedrockClient;
    let caught: unknown;
    try {
      await client.credits({ signal: request.signal });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRequestCaptureError);
    expect((caught as PreparationRequestCaptureError).kind).toBe('ledger');
  } }),
  it({ name: 'refuses native Bedrock spend recording even when a fixture transport incorrectly returns usage', fn: async () => {
    const bodyText = `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content: 'Cat fixture.' } }] })}\n\ndata: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 90, completion_tokens: 10, total_tokens: 100 } })}\n\ndata: [DONE]\n\n`;
    const client = preparationCaptureClient({ provider: 'bedrock', transport: () => Promise.resolve({ status: 200, bodyText }) });
    let caught: unknown;
    try {
      await client.chatText({ ...request, modelId: 'google.gemma-4-e2b' });
    }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRequestCaptureError);
    expect((caught as PreparationRequestCaptureError).kind).toBe('ledger');
  } }),
] });
