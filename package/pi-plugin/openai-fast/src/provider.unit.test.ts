/** Keyless adapter dispatch, hidden target policy, and live catalog lifecycle. @module */
import type { AnyModel, Credential, Provider, SimpleStreamOptions, OpenAICodexResponsesOptions, } from '@earendil-works/pi-ai';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  createPriorityProvider, FAST_PROVIDER, FastModelError, isPriorityTarget, PRIORITY_TARGET_PREFIX, priorityTarget, resolvePriorityBase,
} from '../dist/final/node/index.mjs';
import { caughtFailure, fixtureContext, fixtureModel, } from './host-fixture-model.ts';
import { fixtureOverlay, fixtureRefresh, } from './host-fixture-overlay.ts';
import { fixtureProvider, HOST_TOKEN, } from './host-fixture-provider.ts';

await describe({ name: '', children: [
  //region Identity: internal targets carry capabilities, never original request-auth headers.
  describe({ name: priorityTarget.name, children: [
    it({ name: 'clones capabilities into the fast namespace without inheriting headers or mutating the original', fn: () => {
      const base = fixtureModel({ headers: { 'x-model': 'fixture', }, inputLimits: { maxRequestBytes: 123_456, }, },);
      const target = priorityTarget(base,);
      expect(target,).not.toBe(base,);
      expect(target,).toMatchObject({ provider: FAST_PROVIDER, id: `${PRIORITY_TARGET_PREFIX}${base.id}`,
        api: base.api, input: base.input, contextWindow: base.contextWindow, maxTokens: base.maxTokens, inputLimits: base.inputLimits, },);
      expect(target,).not.toHaveProperty('headers',);
      expect(target.cost,).toBe(base.cost,);
      expect(base.id,).toBe('gpt-host-fixture',);
      expect(base.headers,).toEqual({ 'x-model': 'fixture', },);
      expect(isPriorityTarget(target,),).toBe(true,);
      expect(isPriorityTarget(base,),).toBe(false,);
      expect(isPriorityTarget({ id: `not-${PRIORITY_TARGET_PREFIX}model`, },),).toBe(false,);
    }, },),
  ], },),
  describe({ name: resolvePriorityBase.name, children: [
    it({ name: 'rejects an ordinary input before consulting the original-model lookup', fn: () => {
      let lookedUp = false;
      expect(() => resolvePriorityBase({ model: fixtureModel(), lookup: () => { lookedUp = true; return fixtureModel(); }, },),).toThrow(FastModelError,);
      expect(lookedUp,).toBe(false,);
    }, },),
    it({ name: 'returns the current original rather than stale cloned target metadata', fn: () => {
      const target = priorityTarget(fixtureModel(),);
      const current = fixtureModel({ name: 'Refreshed model', contextWindow: 456_789, },);
      const ids: string[] = [];
      expect(resolvePriorityBase({ model: target, lookup: id => { ids.push(id,); return current; }, },),).toBe(current,);
      expect(ids,).toEqual([current.id,],);
    }, },),
    ...['missing', 'unsupported',].map(reason => it({ name: `rejects ${reason} original with actionable model error`, fn: () => {
      const base = fixtureModel();
      const lookup = () => reason === 'missing' ? undefined : { ...base, api: 'openai-responses' as const, };
      expect(() => resolvePriorityBase({ model: priorityTarget(base,), lookup, },),).toThrow(FastModelError,);
      expect(() => resolvePriorityBase({ model: priorityTarget(base,), lookup, },),).toThrow(base.id,);
    }, },)),
  ], },),
  //endregion Identity

  //region Dispatch: explicit ordinary invocations delegate; priority only uses injected full dispatch.
  describe({ name: createPriorityProvider.name, children: [
    ...['full', 'simple',].map(kind => it({ name: `delegates explicitly invoked ordinary ${kind} streaming unchanged`, fn: async () => {
      const source = fixtureProvider();
      const { overlay, dispatched, } = fixtureOverlay(source.provider,);
      const model = fixtureModel();
      const context = fixtureContext();
      const options: OpenAICodexResponsesOptions & SimpleStreamOptions = { apiKey: HOST_TOKEN, transport: 'auto',
        headers: { 'x-request': 'ordinary', }, serviceTier: 'default', reasoning: 'high', reasoningEffort: 'high', };
      const events = kind === 'full' ? overlay.stream(model, context, options,) : overlay.streamSimple(model, context, options,);
      const result = await events.result();
      expect(source.state.calls,).toHaveLength(1,);
      expect(source.state.calls[0]?.kind,).toBe(kind,);
      expect(source.state.calls[0]?.model,).toBe(model,);
      expect(source.state.calls[0]?.context,).toBe(context,);
      expect(source.state.calls[0]?.options,).toBe(options,);
      expect(options.serviceTier,).toBe('default',);
      expect(dispatched,).toHaveLength(0,);
      expect(result.model,).toBe(model.id,);
    }, },)),
    ...['full', 'simple',].map(kind => it({ name: `routes keyless priority ${kind} through injected full dispatch, preserving caller headers`, fn: async () => {
      const source = fixtureProvider();
      const { overlay, dispatched, } = fixtureOverlay(source.provider,);
      const base = source.provider.getModels()[0];
      if (base === undefined)
        throw new Error('Fixture base model is absent.',);
      const context = fixtureContext();
      const options = { transport: 'auto' as const, reasoning: 'xhigh' as const,
        reasoningEffort: 'xhigh' as const, sessionId: 'fixture-session', headers: { 'X-Conflict': 'caller-wins', }, };
      const target = priorityTarget(base,);
      const events = kind === 'full' ? overlay.stream(target, context, options,) : overlay.streamSimple(target, context, options,);
      const result = await events.result();
      expect(dispatched,).toHaveLength(1,);
      expect(dispatched[0]?.kind,).toBe('full',);
      expect(dispatched[0]?.model,).toBe(base,);
      expect(dispatched[0]?.context,).toBe(context,);
      expect(dispatched[0]?.options,).toMatchObject({ transport: 'auto', reasoningEffort: 'xhigh',
        serviceTier: 'priority', sessionId: 'fixture-session', headers: options.headers, },);
      expect(dispatched[0]?.options?.headers,).toBe(options.headers,);
      expect(dispatched[0]?.options?.apiKey,).toBeUndefined();
      expect(dispatched[0]?.options?.onPayload,).toBeTypeOf('function',);
      expect(source.state.calls,).toHaveLength(0,);
      expect(options,).not.toHaveProperty('serviceTier',);
      expect(result,).toMatchObject({ provider: 'openai-codex', api: 'openai-codex-responses', model: base.id, },);
    }, },)),
    ...['full', 'simple',].flatMap(kind => ['missing', 'unsupported',].map(reason => it({
      name: `rejects ${kind} target when its original is ${reason}, without dispatch or fallback`, fn: () => {
        const source = fixtureProvider();
        const { overlay, dispatched, } = fixtureOverlay(source.provider,);
        const target = priorityTarget(fixtureModel(),);
        source.state.models = reason === 'missing' ? [] : [{ ...fixtureModel(), api: 'openai-responses', },];
        expect(() => kind === 'full' ? overlay.stream(target, fixtureContext(),)
          : overlay.streamSimple(target, fixtureContext(),),).toThrow(FastModelError,);
        expect(dispatched,).toHaveLength(0,);
        expect(source.state.calls,).toHaveLength(0,);
      },
    },))),
    it({ name: 'owns no original auth, headers, endpoint, mixed operations, or deferred operations', fn: async () => {
      const source = fixtureProvider({ dynamic: false, },);
      const failure = new Error('Fixture operation reached.',);
      const provider: Provider = { ...source.provider,
        generateImages: async () => { throw failure; }, classify: async () => { throw failure; },
        fetchDeferred: () => { throw failure; }, cancelDeferred: async () => { throw failure; }, };
      const { overlay, } = fixtureOverlay(provider,);
      expect(overlay.id,).toBe(FAST_PROVIDER,);
      expect(overlay.auth,).not.toBe(provider.auth,);
      expect(overlay.auth.oauth,).toBeUndefined();
      expect(overlay.headers,).toBeUndefined();
      expect(overlay.baseUrl,).toBeUndefined();
      for (const key of ['generateImages', 'classify', 'fetchDeferred', 'cancelDeferred',] as const) {
        expect(overlay[key],).toBeUndefined();
        expect(provider[key],).toBeTypeOf('function',);
      }
      const auth = await overlay.auth.apiKey?.resolve({ ctx: { env: async () => undefined, fileExists: async () => false, },
        signal: new AbortController().signal, },);
      expect(auth,).toEqual({ auth: {}, source: 'routes-to-openai-codex', },);
      expect(source.state.oauthRefreshes,).toBe(0,);
    }, },),
  ], },),
  //endregion Dispatch

  //region Catalog: adapters list only physical targets and never duplicate mixed native operations.
  describe({ name: 'keyless availability and live catalog', children: [
    ...[false, true,].map(allModels => it({ name: `lists targets only with source getAllModels ${String(allModels,)}`, fn: () => {
      const source = fixtureProvider({ allModels, },);
      const { overlay, } = fixtureOverlay(source.provider,);
      const targets = source.provider.getModels().map(priorityTarget,);
      expect(overlay.getModels(),).toEqual(targets,);
      expect(overlay.getAllModels?.(),).toEqual(targets,);
      expect(overlay.filterModels?.(targets, undefined,),).toEqual([],);
      expect(overlay.filterAllModels?.(targets, undefined,),).toEqual([],);
    }, },)),
    it({ name: 'ignores source virtual, image, and classifier entries without applying or copying native availability policy', fn: () => {
      const source = fixtureProvider();
      const base = fixtureModel();
      const virtual = { ...fixtureModel({ id: 'existing-native-virtual', },), api: 'pi-virtual', };
      const image: AnyModel = { ...base, type: 'image', api: 'openrouter-images', output: ['image',], };
      const classifier: AnyModel = { ...base, type: 'classifier', api: 'typesafe-system-one', };
      let filtered = 0;
      const provider: Provider = { ...source.provider, getModels: () => [base, virtual,],
        getAllModels: () => [base, virtual, image, classifier,],
        filterModels: models => { filtered += 1; return models; },
        filterAllModels: models => { filtered += 1; return models; }, };
      const credential: Credential = { type: 'api_key', key: 'synthetic-filter-key', };
      const { overlay, catalogs, } = fixtureOverlay(provider,);
      expect(overlay.getModels(),).toEqual([priorityTarget(base,),],);
      expect(catalogs.at(-1),).toEqual([base,],);
      expect(overlay.getAllModels?.(),).toEqual([priorityTarget(base,),],);
      expect(overlay.filterModels?.([base, virtual,], credential,),).toEqual([],);
      expect(overlay.filterAllModels?.([base, image, classifier,], credential,),).toEqual([],);
      expect(filtered,).toBe(0,);
      expect(provider.getAllModels?.(),).toEqual([base, virtual, image, classifier,],);
      expect(provider.auth,).toBe(source.provider.auth,);
    }, },),
    it({ name: 'uses the live source callback for addition, capability changes, and removal without all-registry enumeration', fn: () => {
      const bootstrap = fixtureProvider();
      const live = fixtureProvider({ models: [fixtureModel({ id: 'live-model', contextWindow: 654_321, },),], },);
      const catalogs: (readonly unknown[])[] = [];
      let reads = 0;
      const adapter = createPriorityProvider({ provider: bootstrap.provider,
        getProvider: () => { reads += 1; return live.provider; },
        lookup: id => live.state.models.find(model => model.id === id,),
        dispatch: () => { throw new Error('Catalog read must not dispatch.',); }, onCatalog: models => { catalogs.push(models,); }, },);
      expect(adapter.getModels(),).toEqual(live.state.models.map(priorityTarget,),);
      live.state.models = [fixtureModel({ id: 'new-live-model', contextWindow: 987_654, },),];
      expect(adapter.getAllModels?.(),).toEqual(live.state.models.map(priorityTarget,),);
      expect(reads,).toBe(2,);
      expect(catalogs,).toEqual([[fixtureModel({ id: 'live-model', contextWindow: 654_321, },),], live.state.models,],);
      expect(bootstrap.state.refreshes,).toBe(0,);
      expect(live.state.refreshes,).toBe(0,);
    }, },),
  ], },),
  //endregion Catalog

  //region Adapter refresh: only read the current source, never refresh it under a second provider ID.
  describe({ name: 'adapter refresh lifecycle', children: [
    ...[false, true,].map(dynamic => it({ name: `synchronizes a source with refresh support ${String(dynamic,)} without invoking its refresh`, fn: async () => {
      const source = fixtureProvider({ dynamic, },);
      const { overlay, catalogs, } = fixtureOverlay(source.provider,);
      source.state.models = [fixtureModel({ id: 'new-model', },),];
      await overlay.refreshModels?.(fixtureRefresh(),);
      expect(source.state.refreshes,).toBe(0,);
      expect(catalogs,).toEqual([source.state.models,],);
    }, },)),
    it({ name: 'does not read or synchronize its source after cancellation', fn: async () => {
      const source = fixtureProvider();
      const { overlay, catalogs, } = fixtureOverlay(source.provider,);
      const controller = new AbortController();
      controller.abort();
      await overlay.refreshModels?.(fixtureRefresh(controller.signal,),);
      expect(catalogs,).toEqual([],);
      expect(source.state.refreshes,).toBe(0,);
    }, },),
    it({ name: 'propagates source catalog read failure without fallback dispatch', fn: async () => {
      const source = fixtureProvider();
      const failure = new Error('Synthetic catalog read failure.',);
      const { overlay, catalogs, } = fixtureOverlay({ ...source.provider, getModels: () => { throw failure; }, },);
      expect(await caughtFailure(async () => { await overlay.refreshModels?.(fixtureRefresh(),); },),).toBe(failure,);
      expect(catalogs,).toEqual([],);
      expect(source.state.calls,).toEqual([],);
    }, },),
  ], },),
  //endregion Adapter refresh
], },);
