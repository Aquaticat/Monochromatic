/** Actual pi sessions confined to disposable storage and synthetic runtime auth. @module */
import { mkdir, mkdtemp, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { InMemoryCredentialStore, InMemoryModelsStore, type Api, type Model, } from '@earendil-works/pi-ai';
import {
  createAgentSession,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ExtensionAPI,
  type ExtensionContext,
} from '@earendil-works/pi-coding-agent';
import { CODEX_PROVIDER, FAST_PROVIDER, registerOpenAIFast, } from '../dist/final/node/index.mjs';
import { requireCodexModel, } from './host-fixture-model.ts';
import { fixtureCredential, fixtureProvider, } from './host-fixture-provider.ts';

//region Workspace ownership: disposal removes only test-created state.

/** Create separate workspace, agent home, model config, and session storage paths. */
export async function fixtureHome() {
  const root = await mkdtemp(join(tmpdir(), 'openai-fast-host-',),);
  const cwd = join(root, 'workspace',);
  const agentDir = join(root, 'agent',);
  try {
    await Promise.all([mkdir(cwd,), mkdir(agentDir,),],);
  }
  catch (error) {
    await rm(root, { recursive: true, force: true, },);
    throw error;
  }
  return {
    root, cwd, agentDir, modelsPath: join(agentDir, 'models.json',), modelsStorePath: join(agentDir, 'models-store.json',),
    sessionDir: join(agentDir, 'sessions',),
    [Symbol.asyncDispose]: async function dispose() { await rm(root, { recursive: true, force: true, },); },
  };
}

/** Workspace contract used by all host and catalog tests. */
export type FixtureHome = Awaited<ReturnType<typeof fixtureHome>>;

//endregion Workspace ownership

//region Real host: install the source before adding the separate keyless adapter.

/** Build actual extension context without ambient extensions, tools, instructions, or auth-file access. */
export async function fixtureHost({ home, source = fixtureProvider(), expired = false, configured = false,
  register = registerOpenAIFast, beforeStart, }: {
  readonly home: FixtureHome;
  readonly source?: ReturnType<typeof fixtureProvider>;
  readonly expired?: boolean;
  readonly configured?: boolean;
  readonly register?: typeof registerOpenAIFast;
  readonly beforeStart?: (runtime: ModelRuntime) => Promise<void>;
},) {
  if (configured) {
    await writeFile(home.modelsPath, JSON.stringify({ providers: { 'openai-codex': {
      headers: { 'x-config-provider': 'configured-provider', 'X-Shared': 'provider-value', },
      modelOverrides: { 'gpt-host-fixture': { name: 'Configured fixture', contextWindow: 333_333,
        maxTokens: 16_384, headers: { 'x-config-model': 'original-model-only', 'x-shared': 'model-value', }, }, },
    }, }, },),);
  }
  const credentials = new InMemoryCredentialStore();
  await credentials.modify(CODEX_PROVIDER, async function seed() { return fixtureCredential({ expired, },); },);
  const runtime = await ModelRuntime.create({ credentials, modelsPath: configured ? home.modelsPath : null,
    modelsStore: new InMemoryModelsStore(), refreshOnCreate: false, allowModelNetwork: false, },);
  runtime.registerNativeProvider(source.provider,);
  const effective = runtime.getProvider(CODEX_PROVIDER,);
  if (effective === undefined)
    throw new Error('Synthetic Codex provider was not registered.',);
  const base = requireCodexModel(runtime.getModel(CODEX_PROVIDER, source.state.models[0]?.id ?? '',),);
  const settings = SettingsManager.inMemory({ defaultProvider: CODEX_PROVIDER, defaultModel: base.id,
    defaultThinkingLevel: 'high', enabledModels: [`${CODEX_PROVIDER}/${base.id}`,], transport: 'auto',
    compaction: { enabled: false, }, retry: { enabled: false, provider: { maxRetries: 0, }, },
    cacheWarming: 'off', enableAnalytics: false, enableInstallTelemetry: false, },);
  const captured: { pi?: ExtensionAPI; ctx?: ExtensionContext; } = {};
  const sessions: AgentSession[] = [];
  const loader = new DefaultResourceLoader({ cwd: home.cwd, agentDir: home.agentDir, settingsManager: settings,
    noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
    extensionFactories: [function extension(pi) {
      captured.pi = pi;
      register({ pi, provider: effective, },);
      pi.on('session_start', function sessionStart(_event, ctx) { captured.ctx = ctx; },);
    },], },);
  try {
    await loader.reload();
    if (loader.getExtensions().errors.length > 0)
      throw new Error(`Fixture extension failed: ${JSON.stringify(loader.getExtensions().errors,)}`,);
    const manager = SessionManager.create(home.cwd, home.sessionDir,);
    const { session, } = await createAgentSession({ cwd: home.cwd, agentDir: home.agentDir, modelRuntime: runtime,
      resourceLoader: loader, model: base, noTools: 'builtin', sessionManager: manager, settingsManager: settings,
      scopedModels: [{ model: base, thinkingLevel: 'high', },], },);
    sessions.push(session,);
    await beforeStart?.(runtime,);
    await session.bindExtensions({},);
    await Promise.all([runtime.getAvailable(CODEX_PROVIDER,), runtime.getAvailable(FAST_PROVIDER,),],);
    const { ctx, pi, } = captured;
    if (ctx === undefined || pi === undefined)
      throw new Error('Actual host did not bind the fixture extension.',);
    /** Resume or branch with SDK restoration against the already registered catalog. */
    async function resume(sessionManager: SessionManager,) {
      await loader.reload();
      const result = await createAgentSession({ cwd: home.cwd, agentDir: home.agentDir, modelRuntime: runtime,
        resourceLoader: loader, noTools: 'builtin', sessionManager, settingsManager: settings, },);
      sessions.push(result.session,);
      try {
        await result.session.bindExtensions({},);
        return result;
      }
      catch (error) {
        result.session.dispose();
        throw error;
      }
    }
    return {
      session, manager, runtime, settings, ctx, pi, source, credentials, base, resume, original: effective,
      [Symbol.dispose]: function dispose() { for (const active of sessions) active.dispose(); },
    };
  }
  catch (error) {
    for (const active of sessions) active.dispose();
    throw error;
  }
}

/** Obtain registration capabilities without the fast plugin's lazy catalog synchronization. */
export async function fixtureRegistrationHost({ home, }: { readonly home: FixtureHome; },) {
  return await fixtureHost({ home, register: () => undefined, },);
}

/** Resolve only genuine native virtual selections, never similarly named physical models. */
export function requireCompanion({ runtime, id, }: { readonly runtime: ModelRuntime; readonly id: string; },): Model<Api> {
  const companion = runtime.getModel(FAST_PROVIDER, id,);
  if (companion === undefined || companion.api !== 'pi-virtual')
    throw new Error('Expected a genuine native pi virtual companion.',);
  return companion;
}

//endregion Real host
