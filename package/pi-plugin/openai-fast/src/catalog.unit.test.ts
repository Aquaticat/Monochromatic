/** Credential-free effective catalog and genuine virtual companion registration. @module */
import { readFile, writeFile, } from 'node:fs/promises';
import { getSupportedThinkingLevels, } from '@earendil-works/pi-ai';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  CODEX_API, CODEX_PROVIDER, createCatalogCredentials, createFastModelRegistration,
  FAST_PROVIDER, FastModelError, loadCodexProvider, PRIORITY_TARGET_PREFIX,
} from '../dist/final/node/index.mjs';
import { caughtFailure, fixtureModel, } from './host-fixture-model.ts';
import { fixtureRegistrationHost as fixtureHost, fixtureHome, } from './host-fixture-session.ts';

await describe({ name: '', children: [
  //region Bootstrap: configured metadata can be discovered without auth or remote refresh.
  describe({ name: createCatalogCredentials.name, children: [
    it({ name: 'reads no secrets, lists no credentials, and refuses modification without invoking its callback', fn: async () => {
      const credentials = createCatalogCredentials();
      let invoked = false;
      expect(await credentials.read(CODEX_PROVIDER,),).toBeUndefined();
      expect(await credentials.read(FAST_PROVIDER,),).toBeUndefined();
      expect(await credentials.list(),).toEqual([],);
      const modified = await caughtFailure(async () => await credentials.modify(CODEX_PROVIDER, async () => {
        invoked = true;
        return { type: 'api_key', key: 'never-stored-fixture', };
      },),);
      const deleted = await caughtFailure(async () => { await credentials.delete(CODEX_PROVIDER,); },);
      expect(modified,).toBeInstanceOf(FastModelError,);
      expect(modified,).toHaveProperty('message', expect.stringContaining('change credentials',),);
      expect(deleted,).toBeInstanceOf(FastModelError,);
      expect(deleted,).toHaveProperty('message', expect.stringContaining('delete credentials',),);
      expect(invoked,).toBe(false,);
      expect(await credentials.list(),).toEqual([],);
    }, },),
  ], },),
  describe({ name: loadCodexProvider.name, children: [
    it({ name: 'includes custom configured models and overrides with their native capabilities and unchanged config', fn: async ctx => {
      await using home = await fixtureHome();
      const original = fixtureModel({ id: 'configured-custom-codex', name: 'Custom configured Codex',
        contextWindow: 654_321, maxTokens: 12_345, input: ['text',],
        headers: { 'x-configured-model': 'custom-fixture', },
        thinkingLevelMap: { high: 'high', xhigh: 'xhigh', low: null, }, },);
      const fetch = ctx.sinon.stub(globalThis, 'fetch',).callsFake(async () => {
        throw new Error('Catalog bootstrap must not make HTTP requests.',);
      },);
      const baseline = await loadCodexProvider({ modelsPath: home.modelsPath, },);
      const overridden = baseline.getModels()[0];
      if (overridden === undefined)
        throw new Error('Installed native Codex catalog is empty.',);
      const serialized = JSON.stringify({ providers: { [CODEX_PROVIDER]: { api: CODEX_API,
        models: [original,], modelOverrides: { [overridden.id]: { name: 'Override fixture', contextWindow: 777_777, }, }, }, }, },);
      await writeFile(home.modelsPath, serialized,);
      const provider = await loadCodexProvider({ modelsPath: home.modelsPath, },);
      const model = provider.getModels().find(entry => entry.id === original.id,);
      expect(provider.id,).toBe(CODEX_PROVIDER,);
      expect(provider.auth.oauth?.isSubscription,).toBe(true,);
      expect(model,).toMatchObject({ id: original.id, name: original.name, api: CODEX_API,
        contextWindow: 654_321, maxTokens: 12_345, input: ['text',], cost: original.cost,
        thinkingLevelMap: original.thinkingLevelMap, },);
      expect(provider.getModels().find(entry => entry.id === overridden.id,),).toMatchObject({ name: 'Override fixture', contextWindow: 777_777, },);
      expect(provider.getModels().map(entry => entry.id,).sort(),).toEqual([...baseline.getModels().map(entry => entry.id,), original.id,].sort(),);
      expect(provider.getModels().some(entry => entry.id.startsWith(PRIORITY_TARGET_PREFIX,),),).toBe(false,);
      expect(await readFile(home.modelsPath, 'utf8',),).toBe(serialized,);
      expect(fetch,).not.toHaveBeenCalled();
    }, },),
    it({ name: 'hydrates a newer disposable cached catalog without credentials or a network refresh', fn: async ctx => {
      await using home = await fixtureHome();
      const cached = fixtureModel({ id: 'cached-native-codex', contextWindow: 543_210, },);
      const cache = JSON.stringify({ [CODEX_PROVIDER]: { models: [cached,], lastModified: Number.MAX_SAFE_INTEGER, checkedAt: 0, }, },);
      await writeFile(home.modelsStorePath, cache,);
      const fetch = ctx.sinon.stub(globalThis, 'fetch',).callsFake(async () => {
        throw new Error('Cached bootstrap must not request remote catalogs.',);
      },);
      const provider = await loadCodexProvider({ modelsPath: home.modelsPath, },);
      expect(provider.getModels(),).toContainEqual(cached,);
      expect(await readFile(home.modelsStorePath, 'utf8',),).toBe(cache,);
      expect(fetch,).not.toHaveBeenCalled();
    }, },),
    it({ name: 'loads the complete native static catalog from a missing disposable config without a login', fn: async () => {
      await using home = await fixtureHome();
      const provider = await loadCodexProvider({ modelsPath: home.modelsPath, },);
      const models = provider.getModels();
      expect(models.length,).toBeGreaterThan(0,);
      expect(models.every(model => model.api === CODEX_API && model.provider === CODEX_PROVIDER,),).toBe(true,);
      expect(new Set(models.map(model => model.id,),).size,).toBe(models.length,);
    }, },),
    ...['{', JSON.stringify({ providers: { [CODEX_PROVIDER]: { models: [{ id: 'invalid-config', contextWindow: 'wrong-type', },], }, }, },),]
      .map((invalid, index) => it({ name: `rejects invalid disposable configuration ${index} with a remediation error`, fn: async () => {
        await using home = await fixtureHome();
        await writeFile(home.modelsPath, invalid,);
        const error = await caughtFailure(async () => await loadCodexProvider({ modelsPath: home.modelsPath, },),);
        expect(error,).toBeInstanceOf(FastModelError,);
        expect(error,).toHaveProperty('message', expect.stringContaining('Correct the model configuration',),);
        expect(await readFile(home.modelsPath, 'utf8',),).toBe(invalid,);
      }, },)),
  ], },),
  //endregion Bootstrap

  //region Native registration: no compatibility allowlist or unrelated settings mutation.
  describe({ name: createFastModelRegistration.name, children: [
    it({ name: 'creates native pi virtual companions for every supplied base and preserves advertised metadata', fn: async () => {
      await using home = await fixtureHome();
      using host = await fixtureHost({ home, },);
      const synchronize = createFastModelRegistration(host.pi,);
      synchronize(host.source.provider.getModels(),);
      const models = [fixtureModel({ id: 'unknown-future-model', },),
        fixtureModel({ id: 'custom-text-only', reasoning: false, input: ['text',], contextWindow: 98_765, maxTokens: 432, },),];
      const settings = host.settings.getSettings();
      synchronize(models,);
      expect(host.runtime.getModels(FAST_PROVIDER,).map(model => model.id,),).toEqual(models.map(model => model.id,),);
      for (const base of models) {
        const companion = host.runtime.getModel(FAST_PROVIDER, base.id,);
        expect(companion,).toMatchObject({ api: 'pi-virtual', provider: FAST_PROVIDER, id: base.id,
          name: `${base.name} Fast`, input: base.input, contextWindow: base.contextWindow, maxTokens: base.maxTokens, },);
        if (companion === undefined)
          throw new Error('Native virtual companion was not registered.',);
        expect(getSupportedThinkingLevels(companion,),).toEqual(getSupportedThinkingLevels(base,),);
      }
      expect(host.settings.getSettings(),).toEqual(settings,);
      expect(host.session.model?.provider,).toBe(CODEX_PROVIDER,);
    }, },),
    it({ name: 'deduplicates structural definitions, updates changed capabilities, and removes disappeared companions', fn: async ctx => {
      await using home = await fixtureHome();
      using host = await fixtureHost({ home, },);
      const register = ctx.sinon.spy(host.pi, 'registerVirtualModel',);
      const unregister = ctx.sinon.spy(host.pi, 'unregisterVirtualModel',);
      const synchronize = createFastModelRegistration(host.pi,);
      const base = fixtureModel();
      const added = fixtureModel({ id: 'new-catalog-model', },);
      synchronize([base,],);
      synchronize([{ ...base, input: [...base.input,], cost: { ...base.cost, input: 99, }, },],);
      expect(register,).toHaveBeenCalledTimes(1,);
      const changed = { ...base, name: 'Updated name', input: ['text',] as ('text' | 'image')[],
        contextWindow: 123_123, maxTokens: 321, thinkingLevelMap: { high: null, xhigh: null, }, };
      synchronize([changed, added,],);
      expect(register,).toHaveBeenCalledTimes(3,);
      expect(host.runtime.getModel(FAST_PROVIDER, base.id,),).toMatchObject({ name: 'Updated name Fast',
        input: ['text',], contextWindow: 123_123, maxTokens: 321, },);
      synchronize([added,],);
      expect(unregister,).toHaveBeenCalledExactlyOnceWith(FAST_PROVIDER, base.id,);
      expect(host.runtime.getModel(FAST_PROVIDER, base.id,),).toBeUndefined();
      synchronize([],);
      expect(host.runtime.getModels(FAST_PROVIDER,),).toEqual([],);
      expect(unregister,).toHaveBeenCalledTimes(2,);
    }, },),
    ...[false, true,].map(collision => it({ name: collision
      ? 'rejects a base catalog containing another model at the generated physical identity'
      : 'rejects upstream IDs inside the reserved local target namespace', fn: async () => {
        await using home = await fixtureHome();
        using host = await fixtureHost({ home, },);
        const synchronize = createFastModelRegistration(host.pi,);
        const base = fixtureModel();
        const reserved = fixtureModel({ id: `${PRIORITY_TARGET_PREFIX}${base.id}`, },);
        expect(() => synchronize(collision ? [base, reserved,] : [reserved,],),).toThrow(FastModelError,);
        expect(() => synchronize(collision ? [base, reserved,] : [reserved,],),).toThrow('internal routing namespace',);
      }, },)),
    it({ name: 'reports an absent physical route rather than falling back to an ordinary model', fn: async () => {
      await using home = await fixtureHome();
      using host = await fixtureHost({ home, },);
      const absent = fixtureModel({ id: 'removed-routing-target', },);
      const synchronize = createFastModelRegistration(host.pi,);
      synchronize([absent,],);
      const companion = host.runtime.getModel(FAST_PROVIDER, absent.id,);
      if (companion === undefined)
        throw new Error('Fixture virtual model was not registered.',);
      const error = await caughtFailure(async () => await host.runtime.resolveModel(companion, [],
        { reason: 'direct', thinkingLevel: 'high', },),);
      expect(error,).toBeInstanceOf(FastModelError,);
      expect(error,).toHaveProperty('message', expect.stringContaining('no current priority target',),);
      expect(host.source.state.calls,).toHaveLength(0,);
    }, },),
  ], },),
  //endregion Native registration
], },);
