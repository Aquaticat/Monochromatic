/** Judge selection through Pi's real headless SDK context. @module */
import { mkdir, mkdtemp, rm, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import {
  createAgentSession,
  DefaultResourceLoader,
  type ExtensionContext,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from '@earendil-works/pi-coding-agent';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { findBudgetModel, } from '../dist/final/node/index.mjs';

await describe({ name: 'headless SDK judge selection', children: [false, true,].map(explicitScope => it({
    name: explicitScope ? 'keeps a nonempty live scope authoritative' : 'uses configured models when SDK live scope is unset',
    fn: async (): Promise<void> => {
      /** Disposable workspace also contains all SDK storage. */
      const root = await mkdtemp(join(tmpdir(), 'auto-mode-sdk-',),);
      await using cleanup = { [Symbol.asyncDispose]: async (): Promise<void> => {
        await rm(root, { recursive: true, force: true, },);
      }, };
      await mkdir(join(root, '.pi',),);
      await writeFile(join(root, '.pi', 'settings.json',), JSON.stringify({ enabledModels: ['openai/gpt-4o-mini',], },),);
      /** Local-only runtime, using a fixture key without sending provider requests. */
      const runtime = await ModelRuntime.create({ authPath: join(root, 'auth.json',), modelsPath: null,
        modelsStorePath: join(root, 'models-store.json',), refreshOnCreate: false, },);
      await runtime.setRuntimeApiKey('openai', 'fixture-not-a-real-key',);
      /** Explicit live scope deliberately differs from persisted settings. */
      const model = runtime.getModel('openai', explicitScope ? 'gpt-4o' : 'gpt-4o-mini',);
      if (model === undefined)
        throw new Error('SDK fixture model is missing',);
      /** Actual context captured by the host's session-start dispatch. */
      const captured: { ctx?: ExtensionContext; } = {};
      /** All ambient extensions and project instructions are excluded. */
      const loader = new DefaultResourceLoader({ cwd: root, agentDir: root,
        noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
        extensionFactories: [pi => {
          pi.on('session_start', (_event, ctx): void => {
            captured.ctx = ctx;
          },);
        },], },);
      await loader.reload();
      /** Same SDK construction and headless binding used by the subagent runner. */
      const { session, } = await createAgentSession({ cwd: root, agentDir: root, modelRuntime: runtime, model,
        resourceLoader: loader, sessionManager: SessionManager.inMemory(root,),
        settingsManager: SettingsManager.create(root, root,),
        ...(explicitScope ? { scopedModels: [{ model, },], } : {}), },);
      using cleanupSession = { [Symbol.dispose]: (): void => {
        session.dispose();
      }, };
      await session.bindExtensions({},);
      /** Fail instead of substituting a fake context when lifecycle binding did not run. */
      const { ctx, } = captured;
      if (ctx === undefined)
        throw new Error('SDK did not emit session_start',);
      expect(ctx.hasUI,).toBe(false,);
      expect(ctx.scopedModels,).toHaveLength(explicitScope ? 1 : 0,);
      expect((await ctx.modelRegistry.getApiKeyAndHeaders(model,)).ok,).toBe(true,);
      /** Selection must not report missing credentials for an authenticated SDK child. */
      const judge = await findBudgetModel({ ctx, },);
      expect(judge.model.id,).toBe(model.id,);
    },
  },)), },);
