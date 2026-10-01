/** Real pi virtual selections, request auth, native payloads, and session history. @module */
import { Type, type AssistantMessage, } from '@earendil-works/pi-ai';
import { SessionManager, } from '@earendil-works/pi-coding-agent';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { CODEX_API, CODEX_PROVIDER, FAST_PROVIDER, isPriorityTarget, PRIORITY_TARGET_PREFIX, registerOpenAIFast, } from '../dist/final/node/index.mjs';
import { verifyHostAbort, } from './host-fixture-abort.ts';
import { fixtureHttp, nativeResponse, nativeFailureResponse, } from './host-fixture-http.ts';
import { fixtureAssistant, fixtureContext, fixtureModel, } from './host-fixture-model.ts';
import { fixtureProvider, HOST_TOKEN, } from './host-fixture-provider.ts';
import { fixtureHome, fixtureHost, requireCompanion, } from './host-fixture-session.ts';

await describe({ name: registerOpenAIFast.name, children: [
  //region Actual native host boundary: selectors show virtual entries, never physical routing targets.
  it({ name: 'registers genuine virtual entries without UI, defaults, enabledModels, or scope changes', fn: async () => {
    await using home = await fixtureHome();
    const source = fixtureProvider({ models: [fixtureModel(), fixtureModel({ id: 'unknown-future-native', reasoning: false, input: ['text',], },),], },);
    using host = await fixtureHost({ home, source, },);
    expect(host.ctx.hasUI,).toBe(false,);
    expect(host.session.model,).toMatchObject({ provider: CODEX_PROVIDER, id: host.base.id, api: CODEX_API, },);
    expect(host.settings.getDefaultProvider(),).toBe(CODEX_PROVIDER,);
    expect(host.settings.getDefaultModel(),).toBe(host.base.id,);
    expect(host.settings.getEnabledModels(),).toEqual([`${CODEX_PROVIDER}/${host.base.id}`,],);
    expect(host.ctx.scopedModels,).toHaveLength(1,);
    expect(host.ctx.scopedModels[0],).toMatchObject({ model: host.base, thinkingLevel: 'high', },);
    expect(host.pi.getCommands(),).toEqual([],);
    expect(host.pi.getAllTools().filter(tool => tool.sourceInfo.source !== 'builtin',),).toEqual([],);
    const virtuals = host.runtime.getModels(FAST_PROVIDER,);
    expect(virtuals.map(model => model.id,),).toEqual(source.state.models.map(model => model.id,),);
    expect(virtuals.every(model => model.api === 'pi-virtual',),).toBe(true,);
    expect(host.runtime.getProvider(CODEX_PROVIDER,),).toBe(host.original,);
    expect(host.runtime.getRegisteredNativeProvider(CODEX_PROVIDER,),).toBe(source.provider,);
    const available = await host.runtime.getAvailable(FAST_PROVIDER,);
    expect(available.some(isPriorityTarget,),).toBe(false,);
    expect(host.ctx.modelRegistry.getAvailable().some(isPriorityTarget,),).toBe(false,);
    expect((await host.runtime.getAllAvailable(FAST_PROVIDER,)).some(model => isPriorityTarget(model,),),).toBe(false,);
    for (const base of source.state.models) {
      const target = host.ctx.modelRegistry.find(FAST_PROVIDER, `${PRIORITY_TARGET_PREFIX}${base.id}`,);
      expect(target,).toMatchObject({ api: CODEX_API, provider: FAST_PROVIDER, contextWindow: base.contextWindow, },);
      expect(target,).not.toHaveProperty('headers',);
      const companion = requireCompanion({ runtime: host.runtime, id: base.id, },);
      expect(available,).toContainEqual(companion,);
      const route = await host.runtime.resolveModel(companion, [], { reason: 'direct', thinkingLevel: 'high', },);
      expect(route.model,).toEqual(target,);
      expect(route.thinkingLevel,).toBe(base.reasoning ? 'high' : 'off',);
    }
    expect(host.source.state.calls,).toHaveLength(0,);
  }, },),
  it({ name: 'rejects fast dispatch before session_start instead of using bootstrap credentials or transport', fn: async () => {
    await using home = await fixtureHome();
    const source = fixtureProvider();
    using host = await fixtureHost({ home, source, beforeStart: async runtime => {
      const target = runtime.getModel(FAST_PROVIDER, `${PRIORITY_TARGET_PREFIX}gpt-host-fixture`,);
      if (target === undefined)
        throw new Error('Actual SDK did not install the adapter before lifecycle binding.',);
      const message = await runtime.complete(target, fixtureContext(),);
      expect(message.stopReason,).toBe('error',);
      expect(message.errorMessage,).toContain('initialized pi session',);
      expect(source.state.calls,).toHaveLength(0,);
    }, },);
    expect(host.session.model?.provider,).toBe(CODEX_PROVIDER,);
  }, },),
  //endregion Actual native host boundary

  //region Native HTTP: original model headers and canonical history survive live registry dispatch.
  it({ name: 'leaves normal HTTP unchanged and requests priority with original ID, high/xhigh, and configured headers', fn: async () => {
    await using home = await fixtureHome();
    const http = fixtureHttp({ responses: [() => nativeResponse(), () => nativeResponse(), () => nativeResponse(), () => nativeResponse(),], },);
    using host = await fixtureHost({ home, source: http.source, configured: true, },);
    const before = host.settings.getSettings();
    await host.session.prompt('Ordinary native request.',);
    const companion = requireCompanion({ runtime: host.runtime, id: host.base.id, },);
    expect(companion,).toMatchObject({ api: 'pi-virtual', name: 'Configured fixture Fast', contextWindow: 333_333, maxTokens: 16_384, },);
    await host.session.setModel(companion,);
    host.session.setThinkingLevel('high',);
    await host.session.prompt('Fast native request with high thinking.',);
    host.session.setThinkingLevel('xhigh',);
    await host.session.prompt('Fast native request with xhigh thinking.',);
    expect(http.requests,).toHaveLength(3,);
    expect(http.requests[0]?.payload,).not.toHaveProperty('service_tier',);
    expect(http.requests[0]?.payload,).toHaveProperty('model', host.base.id,);
    expect(http.requests[0]?.headers.get('x-shared',),).toBe('model-value',);
    for (const [index, effort,] of [[1, 'high',], [2, 'xhigh',],] as const) {
      const request = http.requests[index];
      expect(request?.payload,).toMatchObject({ model: host.base.id, service_tier: 'priority', reasoning: { effort, }, },);
      expect(request?.headers.get('authorization',),).toBe(`Bearer ${HOST_TOKEN}`,);
      expect(request?.headers.get('x-fixture-oauth',),).toBe('resolved',);
      expect(request?.headers.get('x-config-provider',),).toBe('configured-provider',);
      expect(request?.headers.get('x-config-model',),).toBe('original-model-only',);
      expect(request?.headers.get('X-SHARED',),).toBe('model-value',);
      expect(http.source.state.calls[index]?.model,).toMatchObject({ id: host.base.id, contextWindow: 333_333, maxTokens: 16_384, },);
    }
    const assistants = host.session.messages.filter(message => message.role === 'assistant',);
    expect(assistants,).toHaveLength(3,);
    for (const assistant of assistants)
      expect(assistant,).toMatchObject({ model: host.base.id, provider: CODEX_PROVIDER, api: CODEX_API, stopReason: 'stop', },);
    expect(assistants.map(message => message.thinkingLevel,),).toEqual(['high', 'high', 'xhigh',],);
    expect(host.session.getLastAssistantText(),).toBe('Native fixture answer.',);
    expect(host.session.model,).toMatchObject({ api: 'pi-virtual', provider: FAST_PROVIDER, id: host.base.id, },);
    expect(host.settings.getSettings(),).toEqual(before,);
    expect(host.ctx.scopedModels,).toHaveLength(1,);
    const explicit = await host.runtime.completeSimple(companion, fixtureContext(),
      { reasoning: 'high', headers: { 'x-SHARED': 'explicit-caller-value', }, },);
    expect(explicit.stopReason,).toBe('stop',);
    expect(http.requests,).toHaveLength(4,);
    expect(http.requests[3]?.headers.get('X-Shared',),).toBe('explicit-caller-value',);
    expect(http.requests[3]?.headers.get('x-config-model',),).toBe('original-model-only',);
    expect(http.requests[3]?.payload,).toMatchObject({ model: host.base.id, service_tier: 'priority', },);
    expect(host.runtime.getProvider(CODEX_PROVIDER,),).toBe(host.original,);
  }, },),
  it({ name: 'routes tool followups through the same virtual selection and priority transport', fn: async () => {
    await using home = await fixtureHome();
    const http = fixtureHttp({ responses: [() => nativeResponse({ tool: true, },), () => nativeResponse(),], },);
    using host = await fixtureHost({ home, source: http.source, },);
    let executed = 0;
    host.pi.registerTool({ name: 'fixture_tool', label: 'Fixture tool', description: 'Return a synthetic value without side effects.',
      parameters: Type.Object({},), execute: async function execute() {
        executed += 1;
        return { content: [{ type: 'text', text: 'Synthetic tool output.', },], details: {}, };
      }, },);
    host.pi.setActiveTools(['fixture_tool',],);
    await host.session.setModel(requireCompanion({ runtime: host.runtime, id: host.base.id, },),);
    await host.session.prompt('Use the synthetic tool.',);
    expect(executed,).toBe(1,);
    expect(http.requests,).toHaveLength(2,);
    for (const request of http.requests)
      expect(request.payload,).toMatchObject({ model: host.base.id, service_tier: 'priority', },);
    expect(http.requests[1]?.payload,).toHaveProperty('input', expect.arrayContaining([
      expect.objectContaining({ type: 'function_call_output', output: 'Synthetic tool output.', },),
    ],),);
    expect(host.session.messages.filter(message => message.role === 'assistant',).map(message => message.stopReason,),).toEqual(['toolUse', 'stop',],);
    expect(host.session.model?.api,).toBe('pi-virtual',);
    expect(host.session.getLastAssistantText(),).toBe('Native fixture answer.',);
  }, },),
  //endregion Native HTTP

  //region Persistence: virtual selection outlives physical replies, resume, and branch creation.
  it({ name: 'persists fast selection across turns, actual JSONL resume, and branched session restoration', fn: async () => {
    await using home = await fixtureHome();
    using host = await fixtureHost({ home, },);
    const companion = requireCompanion({ runtime: host.runtime, id: host.base.id, },);
    await host.session.setModel(companion,);
    host.session.setThinkingLevel('xhigh',);
    await host.session.prompt('First fast turn.',);
    const branchPoint = host.manager.getLeafId();
    await host.session.prompt('Second fast turn.',);
    expect(host.session.model?.api,).toBe('pi-virtual',);
    const file = host.manager.getSessionFile();
    if (file === undefined || branchPoint === null)
      throw new Error('Actual host did not persist the disposable session.',);
    expect(host.manager.getBranch().filter(entry => entry.type === 'model_change',).at(-1),).toMatchObject({ provider: FAST_PROVIDER, modelId: host.base.id, },);
    host.session.dispose();
    const resumed = await host.resume(SessionManager.open(file, home.sessionDir,),);
    expect(resumed.modelFallbackMessage,).toBeUndefined();
    expect(resumed.session.model,).toMatchObject({ api: 'pi-virtual', provider: FAST_PROVIDER, id: host.base.id, },);
    expect(resumed.session.thinkingLevel,).toBe('xhigh',);
    await resumed.session.prompt('Resumed fast turn.',);
    resumed.session.dispose();
    const branching = SessionManager.open(file, home.sessionDir,);
    const branchedFile = branching.createBranchedSession(branchPoint,);
    if (branchedFile === undefined)
      throw new Error('Actual host did not create the disposable branch.',);
    const branched = await host.resume(SessionManager.open(branchedFile, home.sessionDir,),);
    expect(branched.modelFallbackMessage,).toBeUndefined();
    expect(branched.session.model?.provider,).toBe(FAST_PROVIDER,);
    await branched.session.prompt('Branched fast turn.',);
    expect(host.source.state.calls,).toHaveLength(4,);
    for (const call of host.source.state.calls) {
      expect(call.model.id,).toBe(host.base.id,);
      expect(call.options,).toMatchObject({ serviceTier: 'priority', reasoningEffort: 'xhigh', },);
    }
  }, },),
  //endregion Persistence

  //region OAuth and catalog lifecycle: the fast namespace owns no additional login or stale allowlist.
  it({ name: 'serializes synthetic OAuth refresh, reuses the stored credential, and rejects dispatch after logout', fn: async () => {
    await using home = await fixtureHome();
    using host = await fixtureHost({ home, expired: true, },);
    const companion = requireCompanion({ runtime: host.runtime, id: host.base.id, },);
    expect(host.source.state.oauthRefreshes,).toBe(0,);
    const entered = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    host.source.state.refreshGate = async () => { entered.resolve(); await released.promise; };
    const first = host.runtime.completeSimple(companion, fixtureContext(), { reasoning: 'high', },);
    const second = host.runtime.completeSimple(companion, fixtureContext(), { reasoning: 'xhigh', },);
    let results: readonly AssistantMessage[] = [];
    try {
      await Promise.race([entered.promise, Promise.all([first, second,],),],);
      expect(host.source.state.oauthRefreshes,).toBe(1,);
      expect(host.source.state.calls,).toHaveLength(0,);
    }
    finally {
      released.resolve();
      results = await Promise.all([first, second,],);
    }
    expect(results.every(message => message.stopReason === 'stop',),).toBe(true,);
    const later = await host.runtime.completeSimple(companion, fixtureContext(), { reasoning: 'high', },);
    expect(later.stopReason,).toBe('stop',);
    expect(host.source.state.oauthRefreshes,).toBe(1,);
    expect(host.source.state.calls,).toHaveLength(3,);
    expect(await host.credentials.read(CODEX_PROVIDER,),).toMatchObject({ type: 'oauth', refresh: 'fixture-rotated-refresh', access: HOST_TOKEN, },);
    expect(await host.credentials.list(),).toEqual([{ providerId: CODEX_PROVIDER, type: 'oauth', },],);
    expect(await host.credentials.read(FAST_PROVIDER,),).toBeUndefined();
    for (const call of host.source.state.calls)
      expect(call.options,).toHaveProperty('apiKey', HOST_TOKEN,);
    await host.runtime.logout(CODEX_PROVIDER,);
    const denied = await host.runtime.completeSimple(companion, fixtureContext(), { reasoning: 'high', },);
    expect(denied.stopReason,).toBe('error',);
    expect(denied.errorMessage,).toContain('not configured',);
    expect(host.source.state.calls,).toHaveLength(3,);
    expect(host.source.state.oauthRefreshes,).toBe(1,);
    expect(await host.credentials.list(),).toEqual([],);
  }, },),
  it({ name: 'adds, updates, and removes virtual companions when the actual native source catalog refreshes', fn: async () => {
    await using home = await fixtureHome();
    using host = await fixtureHost({ home, },);
    const changed = fixtureModel({ name: 'Refreshed fixture', contextWindow: 444_444, maxTokens: 22_222, input: ['text',], },);
    const added = fixtureModel({ id: 'new-native-model', },);
    host.source.state.nextModels = [changed, added,];
    const updated = await host.runtime.refresh({ providers: [CODEX_PROVIDER,], allowNetwork: false, },);
    expect(updated.errors.size,).toBe(0,);
    expect(requireCompanion({ runtime: host.runtime, id: changed.id, },),).toMatchObject({ name: 'Refreshed fixture Fast',
      contextWindow: 444_444, maxTokens: 22_222, input: ['text',], },);
    expect(requireCompanion({ runtime: host.runtime, id: added.id, },).api,).toBe('pi-virtual',);
    host.source.state.nextModels = [added,];
    const removed = await host.runtime.refresh({ providers: [CODEX_PROVIDER,], allowNetwork: false, },);
    expect(removed.errors.size,).toBe(0,);
    expect(host.runtime.getModel(FAST_PROVIDER, changed.id,),).toBeUndefined();
    expect(host.runtime.getModel(FAST_PROVIDER, `${PRIORITY_TARGET_PREFIX}${changed.id}`,),).toBeUndefined();
    expect(host.runtime.getModels(FAST_PROVIDER,).map(model => model.id,),).toEqual([added.id,],);
    expect((await host.runtime.getAvailable(FAST_PROVIDER,)).some(isPriorityTarget,),).toBe(false,);
  }, },),
  //endregion OAuth and catalog lifecycle

  //region Terminal failures: the host sees native failure or abort without a normal-tier retry.
  ...['upstream_fixture_error', 'context_length_exceeded',].map(code => it({
    name: `surfaces native HTTP ${code} without fallback`, fn: async () => {
      await using home = await fixtureHome();
      const http = fixtureHttp({ responses: [() => nativeFailureResponse({ code, message: 'Synthetic native failure.', },),], },);
      using host = await fixtureHost({ home, source: http.source, },);
      await host.session.setModel(requireCompanion({ runtime: host.runtime, id: host.base.id, },),);
      await host.session.prompt('Trigger native failure packet.',);
      const assistant = host.session.messages.findLast(message => message.role === 'assistant',);
      expect(assistant,).toMatchObject({ stopReason: 'error', model: host.base.id, provider: CODEX_PROVIDER, api: CODEX_API, },);
      expect(assistant,).toHaveProperty('errorMessage', expect.stringContaining(code,),);
      expect(http.requests,).toHaveLength(1,);
      expect(http.requests[0]?.payload,).toHaveProperty('service_tier', 'priority',);
    },
  },)),
  ...[false, true,].map(fast => it({ name: fast
    ? 'recognizes original-response overflow under a virtual fast selection with a different target provider'
    : 'positive control recognizes native ordinary-response overflow', fn: async () => {
      await using home = await fixtureHome();
      const source = fixtureProvider();
      source.state.reply = call => fixtureAssistant({ model: call.model, overrides: { usage: {
        input: call.model.contextWindow + 100, output: 2, cacheRead: 0, cacheWrite: 0,
        totalTokens: call.model.contextWindow + 102,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0, }, }, }, },);
      using host = await fixtureHost({ home, source, },);
      const reasons: string[] = [];
      host.pi.on('session_before_compact', event => { reasons.push(event.reason,); return { cancel: true, }; },);
      host.settings.applyOverrides({ compaction: { enabled: true, reserveTokens: 256, keepRecentTokens: 0, }, },);
      if (fast)
        await host.session.setModel(requireCompanion({ runtime: host.runtime, id: host.base.id, },),);
      await host.session.prompt('Synthetic usage exceeds original native context.',);
      expect(reasons,).toEqual(['overflow',],);
      expect(source.state.calls,).toHaveLength(1,);
      expect(host.session.messages.findLast(message => message.role === 'assistant',),).toMatchObject({ model: host.base.id, provider: CODEX_PROVIDER, },);
    },
  },)),
  ...['upstream failure', 'maximum context length exceeded',].map(message => it({
    name: `surfaces ${message} without ordinary fallback or extra dispatch`, fn: async () => {
      await using home = await fixtureHome();
      const source = fixtureProvider();
      source.state.reply = call => fixtureAssistant({ model: call.model, overrides: { stopReason: 'error', errorMessage: message, }, },);
      using host = await fixtureHost({ home, source, },);
      await host.session.setModel(requireCompanion({ runtime: host.runtime, id: host.base.id, },),);
      await host.session.prompt('Trigger synthetic provider failure.',);
      const assistant = host.session.messages.findLast(entry => entry.role === 'assistant',);
      expect(assistant,).toMatchObject({ stopReason: 'error', errorMessage: message, model: host.base.id, provider: CODEX_PROVIDER, api: CODEX_API, },);
      expect(source.state.calls,).toHaveLength(1,);
      expect(source.state.calls[0]?.options,).toHaveProperty('serviceTier', 'priority',);
      expect(host.session.model?.api,).toBe('pi-virtual',);
    },
  },)),
  it({ name: 'surfaces actual host cancellation without fallback and retains the virtual selection', fn: verifyHostAbort, timeout: 15_000, },),
  //endregion Terminal failures
], },);
