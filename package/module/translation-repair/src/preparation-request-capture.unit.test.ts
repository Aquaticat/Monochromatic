import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  blockPairingQuestion,
  captureBlockPairingRequests,
  COMPLETION_CAP,
  DEFAULT_RETRY_POLICY,
  hashContent,
  PairingEvidenceError,
  prepareBlockPairing,
  PreparationRequestCaptureError,
  PROVIDER_ORDER,
  reachOf,
  type RosterModelId,
  STAGE_RETRY_ROUNDS,
} from '../dist/final/node/index.mjs';
import { qualificationFixture, } from './qualified-block-pairing.test-fixture.ts';

const l = tagged({ tag: 'preparation-request-capture-test' });
const question = { sourceBlocks: [{ index: 0, text: '猫睡了。' }, { index: 1, text: '它喜欢盒子。' }],
  targetBlocks: [{ index: 0, text: 'The cat slept.' }, { index: 1, text: 'She loves boxes.' }] };
const modelIds = ['hf:Qwen/Qwen3.8-27B', 'google.gemma-4-e2b', 'deepseek-v4.1-flash'] as const;
const exchangeTimeoutMs = 5_000;

await describe({ name: captureBlockPairingRequests.name, children: [
  it({ name: 'captures every permitted native gateway without fetch, credentials or ledger operations', fn: async ctx => {
    const sentinel = new Error('unexpected fetch during request-only capture');
    const fetch = ctx.sinon.stub(globalThis, 'fetch').callsFake(() => { throw sentinel; });
    let caught: unknown;
    try { await globalThis.fetch('data:text/plain,capture-observation-control'); }
    catch (error) { caught = error; }
    expect(caught).toBe(sentinel);
    expect(fetch).toHaveBeenCalledExactlyOnceWith('data:text/plain,capture-observation-control');
    fetch.resetHistory();

    const manifest = await captureBlockPairingRequests({ question, modelIds, exchangeTimeoutMs, signal: new AbortController().signal, l });
    expect(fetch).not.toHaveBeenCalled();
    expect(new Set(manifest.requests.map(request => request.provider))).toEqual(new Set(PROVIDER_ORDER));
    expect(manifest.modelIds).toEqual(modelIds);
    expect(manifest.question.sourceBlocks).toEqual(question.sourceBlocks);
    expect(manifest.question.targetBlocks).toEqual(question.targetBlocks);
    expect(JSON.stringify(manifest)).not.toContain('preparation-request-capture-only');
    expect(JSON.stringify(manifest)).not.toContain('authorization');
    const { requestConfigurationDigest, ...data } = manifest;
    expect(requestConfigurationDigest).toBe(hashContent({ content: JSON.stringify(data) }));
    for (const request of manifest.requests) {
      expect(request.method).toBe('POST');
      const body = JSON.parse(request.bodyJson) as Record<string, unknown>;
      expect(body['max_tokens'] ?? body['max_completion_tokens']).toBe(COMPLETION_CAP[request.modelId]);
      for (const key of ['temperature', 'thinking', 'budget_tokens', 'reasoning_effort', 'reasoning', 'effort'])
        expect(Object.hasOwn(body, key)).toBe(false);
      expect(Object.hasOwn(request, 'headers')).toBe(false);
    }
    for (const bounds of manifest.bounds) {
      const reach = reachOf({ modelId: bounds.modelId });
      expect(bounds.providers).toEqual(PROVIDER_ORDER.filter(provider => reach[provider]));
      expect(bounds.maxStageCalls).toBe(1 + STAGE_RETRY_ROUNDS);
      expect(bounds.maxHttpAttemptsPerProvider).toBe(1 + DEFAULT_RETRY_POLICY.limit);
      expect(bounds.maxModelPosts).toBe(bounds.maxStageCalls * bounds.providers.length * bounds.maxHttpAttemptsPerProvider);
    }
  } }),
  it({ name: 'matches complete bodies from the actual preparation caller rather than a prompt-only proxy', fn: async () => {
    const f = qualificationFixture();
    const acquired = await prepareBlockPairing(f.input);
    expect(acquired.kind).toBe('paired');
    const manifest = await captureBlockPairingRequests({ question: blockPairingQuestion({ pair: f.input.pair }),
      modelIds: f.input.modelIds, exchangeTimeoutMs: f.input.exchangeTimeoutMs, signal: f.input.signal, l: f.input.l });
    const actual = f.calls.toSorted();
    const registered = manifest.requests.filter(request => request.provider === 'synthetic').map(request => request.bodyJson).toSorted();
    expect(registered).toEqual(actual);
    expect(f.calls).toHaveLength(2);
  } }),
  it({ name: 'retains source delimiters and knob words as content rather than treating them as controls', fn: async () => {
    const pathToken = ['$', '{path}'].join('');
    const sourceBlocks = [{ index: 0, text: ['```\n"temperature": 1\n```', `${pathToken}\\name`, '“猫”'].join('\n') }, { index: 1, text: 'reasoning_effort is quoted prose.' }];
    const manifest = await captureBlockPairingRequests({ question: { ...question, sourceBlocks }, modelIds: [modelIds[0]],
      exchangeTimeoutMs, signal: new AbortController().signal, l });
    expect(manifest.question.sourceBlocks).toEqual(sourceBlocks);
    expect(manifest.requests.length).toBeGreaterThan(0);
    expect(manifest.requests.every(request => request.bodyJson.includes('reasoning_effort is quoted prose.'))).toBe(true);
  } }),
  it({ name: 'snapshots caller inputs before asynchronous capture and returns owned data', fn: async () => {
    const mutableQuestion = structuredClone(question);
    const mutableModels: RosterModelId[] = [...modelIds];
    const before = structuredClone(mutableQuestion);
    const pending = captureBlockPairingRequests({ question: mutableQuestion, modelIds: mutableModels,
      exchangeTimeoutMs, signal: new AbortController().signal, l });
    mutableModels.splice(0);
    mutableQuestion.sourceBlocks.splice(0);
    mutableQuestion.targetBlocks.splice(0);
    const result = await pending;
    expect(mutableModels).toEqual([]);
    expect(result.modelIds).toEqual(modelIds);
    expect(result.question.sourceBlocks).toEqual(before.sourceBlocks);
    expect(result.question.targetBlocks).toEqual(before.targetBlocks);
    Object.defineProperty(result.question.protocol.responseFormat.json_schema, 'name', { value: 'changed returned schema' });
    const repeated = await captureBlockPairingRequests({ question, modelIds, exchangeTimeoutMs, signal: new AbortController().signal, l });
    expect(repeated.question.protocol.responseFormat.json_schema.name).toBe('block_pairing');
  } }),
  it({ name: 'binds native timeout and electorate order without adding prompt nonces or new payload variants', fn: async () => {
    const first = await captureBlockPairingRequests({ question, modelIds, exchangeTimeoutMs, signal: new AbortController().signal, l });
    const changed = await captureBlockPairingRequests({ question, modelIds: modelIds.toReversed(), exchangeTimeoutMs: exchangeTimeoutMs + 1, signal: new AbortController().signal, l });
    expect(changed.requestConfigurationDigest).not.toBe(first.requestConfigurationDigest);
    expect(changed.question).toEqual(first.question);
    expect(changed.requests.map(request => request.bodyJson).toSorted()).toEqual(first.requests.map(request => request.bodyJson).toSorted());
  } }),
  ...[0, -1, Number.NaN, Number.POSITIVE_INFINITY].map(timeout => it({ name: `refuses invalid native timeout ${String(timeout)}`, fn: async () => {
    let caught: unknown;
    try { await captureBlockPairingRequests({ question, modelIds, exchangeTimeoutMs: timeout, signal: new AbortController().signal, l }); }
    catch (error) { caught = error; }
    expect(caught).toBeInstanceOf(PreparationRequestCaptureError);
    expect((caught as PreparationRequestCaptureError).kind).toBe('timeout');
  } })),
  ...[{ sourceBlocks: [], targetBlocks: question.targetBlocks }, { sourceBlocks: question.sourceBlocks, targetBlocks: [] },
    { sourceBlocks: question.sourceBlocks.slice(0, 1), targetBlocks: question.targetBlocks.slice(0, 1) }].map((structural, index) => it({
      name: `does not register a model call for structural dispatch ${index}`, fn: async () => {
        let caught: unknown;
        try { await captureBlockPairingRequests({ question: structural, modelIds, exchangeTimeoutMs, signal: new AbortController().signal, l }); }
        catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(PreparationRequestCaptureError);
        expect((caught as PreparationRequestCaptureError).kind).toBe('question');
      },
    })),
  it({ name: 'rejects duplicate and empty configured electorates before capture', fn: async () => {
    for (const roster of [[], [...modelIds, ...modelIds]]) {
      let caught: unknown;
      try { await captureBlockPairingRequests({ question, modelIds: roster, exchangeTimeoutMs, signal: new AbortController().signal, l }); }
      catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(PairingEvidenceError);
    }
  } }),
  it({ name: 'preserves caller cancellation before or during local request materialization', fn: async () => {
    for (const before of [true, false]) {
      const controller = new AbortController();
      const reason = new Error('caller canceled capture fixture');
      if (before) controller.abort(reason);
      const pending = captureBlockPairingRequests({ question, modelIds, exchangeTimeoutMs, signal: controller.signal, l });
      if (!before) controller.abort(reason);
      let caught: unknown;
      try { await pending; }
      catch (error) { caught = error; }
      expect(caught).toBe(reason);
    }
  } }),
] });
