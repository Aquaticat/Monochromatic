import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingQuestion,
  captureBlockPairingRequests,
  DEFAULT_RETRY_POLICY,
  type ModelTransport,
  prepareBlockPairing,
  PROVIDER_ORDER,
  type PreparationProviderRequest,
  type ProviderRecord,
  reachOf,
} from '../dist/final/node/index.mjs';
import { qualificationFixture, } from './qualified-block-pairing.test-fixture.ts';
import { nativePreparationClients, } from './preparation-native-clients.test-fixture.ts';
import { preparationFixtureStream, routedPreparationFixture, } from './preparation-request-routing.test-fixture.ts';

await describe({ name: 'captured preparation bounds against native callers', children: [
  ...([
    { provider: 'synthetic', modelId: 'hf:Qwen/Qwen3.8-27B' },
    { provider: 'hyper', modelId: 'hf:Qwen/Qwen3.8-27B' },
    { provider: 'bedrock', modelId: 'google.gemma-4-e2b' },
    { provider: 'openrouter', modelId: 'deepseek-v4.1-flash' },
  ] as const).map(({ provider: activeProvider, modelId }) => it({
    name: `contains actual lost-stage rounds and native HTTP retries for ${activeProvider} without an unregistered nudge`, fn: async () => {
      const f = qualificationFixture({ modelIds: [modelId] });
      const question = blockPairingQuestion({ pair: f.input.pair });
      const manifest = await captureBlockPairingRequests({ question, modelIds: [modelId], exchangeTimeoutMs: f.input.exchangeTimeoutMs, signal: f.input.signal, l: f.input.l });
      const posts: string[] = [];
      const transports = Object.fromEntries(PROVIDER_ORDER.map(provider => [provider, ((exchange) => {
        if (provider !== activeProvider) throw new Error('dry fixture provider must not receive a request');
        if ((exchange.method !== 'POST') || (exchange.bodyJson === undefined)) throw new Error('expected fixture model POST');
        posts.push(exchange.bodyJson);
        return Promise.resolve({ status: 503, bodyText: 'fixture transient failure without a completed payload' });
      }) satisfies ModelTransport])) as ProviderRecord<ModelTransport>;
      const callers = nativePreparationClients({ transports, retryPolicy: { ...DEFAULT_RETRY_POLICY, baseMs: 1 } });
      const initialDry = Object.fromEntries(PROVIDER_ORDER.map(provider => [provider, provider !== activeProvider])) as ProviderRecord<boolean>;
      const routed = routedPreparationFixture({ callers, initialDry });
      const result = await prepareBlockPairing({ ...f.input, client: routed.client });
      const [bounds] = manifest.bounds;
      const registered = manifest.requests.find(candidate => candidate.provider === activeProvider);
      if ((bounds === undefined) || (registered === undefined)) throw new Error('missing registered fixture route');
      expect(routed.calls).toHaveLength(bounds.maxStageCalls);
      expect(posts).toHaveLength(bounds.maxStageCalls * bounds.maxHttpAttemptsPerProvider);
      expect(posts.length).toBeLessThanOrEqual(bounds.maxModelPosts);
      expect(routed.refused).toEqual([]);
      expect(result.kind).toBe('fallback');
      expect(posts.every(body => body === registered.bodyJson)).toBe(true);
      expect(routed.calls.every(call => JSON.stringify(call.messages) === JSON.stringify(manifest.question.protocol.messages))).toBe(true);
      expect(routed.calls.every(call => JSON.stringify(call.responseFormat) === JSON.stringify(manifest.question.protocol.responseFormat))).toBe(true);
    },
  })),
  ...(['hf:Qwen/Qwen3.8-27B', 'google.gemma-4-e2b', 'deepseek-v4.1-flash'] as const).map(modelId => it({
    name: `contains native route fallback and exact provider bodies for ${modelId}`, fn: async () => {
      const f = qualificationFixture({ modelIds: [modelId] });
      const question = blockPairingQuestion({ pair: f.input.pair });
      const manifest = await captureBlockPairingRequests({ question, modelIds: [modelId], exchangeTimeoutMs: f.input.exchangeTimeoutMs, signal: f.input.signal, l: f.input.l });
      const reach = reachOf({ modelId });
      const providers = PROVIDER_ORDER.filter(provider => reach[provider]);
      const last = providers.at(-1);
      if (last === undefined) throw new Error('fixture requires a text-serving route');
      const observed: PreparationProviderRequest[] = [];
      const transports = Object.fromEntries(PROVIDER_ORDER.map(provider => [provider, ((exchange) => {
        if ((exchange.method !== 'POST') || (exchange.bodyJson === undefined)) throw new Error('expected fixture model POST');
        observed.push({ modelId, provider, method: 'POST', bodyJson: exchange.bodyJson, url: exchange.url, label: exchange.label,
          ...((exchange.wireFormat === undefined) ? {} : { wireFormat: exchange.wireFormat }),
          ...((exchange.maxAnswerChars === undefined) ? {} : { maxAnswerChars: exchange.maxAnswerChars }) });
        if (provider !== last) return Promise.resolve({ status: 402, bodyText: 'fixture payment refusal' });
        const bodyText = preparationFixtureStream((exchange.wireFormat === undefined) ? {} : { wireFormat: exchange.wireFormat });
        return Promise.resolve({ status: 200, bodyText });
      }) satisfies ModelTransport])) as ProviderRecord<ModelTransport>;
      const callers = nativePreparationClients({ transports, retryPolicy: { limit: 0, baseMs: 1 } });
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
