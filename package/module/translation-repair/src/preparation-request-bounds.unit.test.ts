import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingQuestion,
  captureBlockPairingRequests,
  createSyntheticClient,
  DEFAULT_RETRY_POLICY,
  type ModelCaller,
  preparationCaptureClient,
  prepareBlockPairing,
  PROVIDER_ORDER,
  type PreparationProviderRequest,
  type ProviderRecord,
  reachOf,
} from '../dist/final/node/index.mjs';
import { qualificationFixture, } from './qualified-block-pairing.test-fixture.ts';
import { preparationFixtureStream, routedPreparationFixture, } from './preparation-request-routing.test-fixture.ts';

await describe({ name: 'captured preparation bounds against native callers', children: [
  it({ name: 'contains actual lost-stage rounds and native HTTP retries without an unregistered nudge', fn: async () => {
    const modelId = 'hf:Qwen/Qwen3.8-27B' as const;
    const f = qualificationFixture({ modelIds: [modelId] });
    const question = blockPairingQuestion({ pair: f.input.pair });
    const manifest = await captureBlockPairingRequests({ question, modelIds: [modelId], exchangeTimeoutMs: f.input.exchangeTimeoutMs, signal: f.input.signal, l: f.input.l });
    const posts: string[] = [];
    const synthetic = createSyntheticClient({ apiKey: 'fixture-only', retryPolicy: { ...DEFAULT_RETRY_POLICY, baseMs: 1 },
      transport: exchange => {
        if ((exchange.method !== 'POST') || (exchange.bodyJson === undefined)) throw new Error('expected fixture model POST');
        posts.push(exchange.bodyJson);
        return Promise.resolve({ status: 503, bodyText: 'fixture transient failure without a completed payload' });
      },
    });
    function unexpectedProvider(): never {
      throw new Error('dry fixture provider must not receive a request');
    }
    const routed = routedPreparationFixture({ callers: { synthetic,
      hyper: { chatText: unexpectedProvider }, bedrock: { chatText: unexpectedProvider }, openrouter: { chatText: unexpectedProvider } },
      initialDry: { synthetic: false, hyper: true, bedrock: true, openrouter: true } });
    const result = await prepareBlockPairing({ ...f.input, client: routed.client });
    const [bounds] = manifest.bounds;
    const registered = manifest.requests.find(candidate => candidate.provider === 'synthetic');
    if ((bounds === undefined) || (registered === undefined)) throw new Error('missing registered fixture route');
    expect(routed.calls).toHaveLength(bounds.maxStageCalls);
    expect(posts).toHaveLength(bounds.maxStageCalls * bounds.maxHttpAttemptsPerProvider);
    expect(posts.length).toBeLessThanOrEqual(bounds.maxModelPosts);
    expect(routed.refused).toEqual([]);
    expect(result.kind).toBe('fallback');
    expect(posts.every(body => body === registered.bodyJson)).toBe(true);
    expect(routed.calls.every(call => JSON.stringify(call.messages) === JSON.stringify(manifest.question.protocol.messages))).toBe(true);
    expect(routed.calls.every(call => JSON.stringify(call.responseFormat) === JSON.stringify(manifest.question.protocol.responseFormat))).toBe(true);
  } }),
  ...['hf:Qwen/Qwen3.8-27B', 'google.gemma-4-e2b', 'deepseek-v4.1-flash'].map(model => it({
    name: `contains native route fallback and exact provider bodies for ${model}`, fn: async () => {
      const modelId = model as Parameters<typeof reachOf>[0]['modelId'];
      const f = qualificationFixture({ modelIds: [modelId] });
      const question = blockPairingQuestion({ pair: f.input.pair });
      const manifest = await captureBlockPairingRequests({ question, modelIds: [modelId], exchangeTimeoutMs: f.input.exchangeTimeoutMs, signal: f.input.signal, l: f.input.l });
      const reach = reachOf({ modelId });
      const providers = PROVIDER_ORDER.filter(provider => reach[provider]);
      const last = providers.at(-1);
      if (last === undefined) throw new Error('fixture requires a text-serving route');
      const observed: PreparationProviderRequest[] = [];
      const callers = Object.fromEntries(PROVIDER_ORDER.map(provider => [provider, preparationCaptureClient({ provider,
        transport: exchange => {
          if ((exchange.method !== 'POST') || (exchange.bodyJson === undefined)) throw new Error('expected fixture model POST');
          observed.push({ modelId, provider, method: 'POST', bodyJson: exchange.bodyJson, url: exchange.url, label: exchange.label,
            ...((exchange.wireFormat === undefined) ? {} : { wireFormat: exchange.wireFormat }),
            ...((exchange.maxAnswerChars === undefined) ? {} : { maxAnswerChars: exchange.maxAnswerChars }) });
          if (provider !== last) return Promise.resolve({ status: 402, bodyText: 'fixture payment refusal' });
          const bodyText = preparationFixtureStream((exchange.wireFormat === undefined) ? {} : { wireFormat: exchange.wireFormat });
          return Promise.resolve({ status: 200, bodyText });
        },
      })])) as ProviderRecord<ModelCaller>;
      const routed = routedPreparationFixture({ callers, initialDry: { synthetic: false, hyper: false, bedrock: false, openrouter: false } });
      const result = await prepareBlockPairing({ ...f.input, client: routed.client });
      expect(observed.map(request => request.provider)).toEqual(providers);
      expect(routed.refused).toEqual(providers.slice(0, -1));
      expect(routed.calls).toHaveLength(1);
      expect(observed).toEqual(manifest.requests);
      const [bounds] = manifest.bounds;
      if (bounds === undefined) throw new Error('expected registered bounds');
      expect(observed.length).toBeLessThanOrEqual(bounds.maxModelPosts);
      if ((result.kind !== 'paired') && (result.kind !== 'fallback')) throw new Error('expected queried preparation');
      if (result.evidence.kind !== 'queried') throw new Error('fixture cannot use historical cache');
      expect(result.evidence.outcome.outcomes).toHaveLength(1);
      expect(result.evidence.outcome.pairs).toEqual([]);
    },
  })),
] });
