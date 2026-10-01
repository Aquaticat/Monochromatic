/**
 * Actual pi sessions confined to disposable storage and synthetic runtime auth.
 *
 * @module
 */
import type { InMemoryCredentialStore, Api, Model, } from '@earendil-works/pi-ai';
import {
  createAgentSession,
  DefaultResourceLoader,
  type ModelRuntime,
  SessionManager,
  type SettingsManager,
  type AgentSession,
  type ExtensionAPI,
  type ExtensionContext,
  type SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { FAST_PROVIDER, registerOpenAIFast, } from '../dist/final/node/index.mjs';
import { fixtureHome as createFixtureHome, type FixtureHome, } from './host-fixture-home.ts';
import { fixtureProvider, } from './host-fixture-provider.ts';
import { fixtureRuntime, } from './host-fixture-runtime.ts';

//region Real host: native source precedes the separate keyless adapter.

/** {@inheritDoc createFixtureHome} */
export function fixtureHome(): Promise<FixtureHome> {
  return createFixtureHome();
}

/** Synthetic resources and extension installation choices for one host. */
export type FixtureHostOptions = {
  readonly home: FixtureHome;
  readonly source?: ReturnType<typeof fixtureProvider>;
  readonly expired?: boolean;
  readonly configured?: boolean;
  readonly register?: typeof registerOpenAIFast;
  readonly beforeStart?: (runtime: ForeignHostCapability<ModelRuntime>) => Promise<void>;
};

/** Actual SDK sessions and registry handles, owned only by one fixture. */
export type FixtureHost = {
  readonly session: AgentSession;
  readonly manager: SessionManager;
  readonly runtime: ModelRuntime;
  readonly settings: SettingsManager;
  readonly ctx: ExtensionContext;
  readonly pi: ExtensionAPI;
  readonly source: ReturnType<typeof fixtureProvider>;
  readonly credentials: InMemoryCredentialStore;
  readonly base: Model<'openai-codex-responses'>;
  readonly original: NonNullable<ReturnType<ModelRuntime['getProvider']>>;
  readonly resume: (manager: ForeignHostCapability<SessionManager>) => ReturnType<typeof createAgentSession>;
  readonly [Symbol.dispose]: () => void;
};

/**
 * Build actual extension context without ambient resources or auth-file access.
 *
 * @param home - independently disposable workspace
 * @param source - finite native provider with synthetic OAuth
 * @param expired - expired credential makes native refresh observable
 * @param configured - exercise original provider and model header overrides
 * @param register - built plugin registration or registration-only fixture
 * @param beforeStart - verify dispatch before the real session-start binding
 * @returns initialized actual SDK host with deterministic disposal
 * @example
 * ```ts
 * await using home = await fixtureHome();
 * using host = await fixtureHost({ home });
 * ```
 */
export async function fixtureHost({ home, source = fixtureProvider(), expired = false, configured = false,
  register = registerOpenAIFast, beforeStart, }: FixtureHostOptions,): Promise<FixtureHost> {
  /** Independently initialized native services retain original provider and settings ownership. */
  const { credentials, runtime, effective, base, settings, } = await fixtureRuntime({ home, source, expired, configured, },);
  /** Host callbacks supply actual extension capabilities only after binding. */
  const captured: { pi?: ExtensionAPI; ctx?: ExtensionContext; } = {};
  /** Every created or restored session remains under this fixture's cleanup. */
  const sessions: AgentSession[] = [];
  /** Initialization failures dispose already-created sessions automatically. */
  using initialization = {
    transferred: false,
    [Symbol.dispose]: function dispose(): void {
      if (!this.transferred) {
        for (const active of sessions)
          active.dispose();
      }
    },
  };
  /** Loader installs only the supplied extension factory in disposable paths. */
  const loader = new DefaultResourceLoader({ cwd: home.cwd, agentDir: home.agentDir, settingsManager: settings,
    noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
    extensionFactories: [function extension(pi: ForeignHostCapability<ExtensionAPI>): void {
      captured.pi = pi;
      register({ pi, provider: effective, },);
      pi.on('session_start', function sessionStart(_event: ForeignBorrowed<SessionStartEvent>, ctx: ForeignHostCapability<ExtensionContext>): void { captured.ctx = ctx; },);
    },], },);
  await loader.reload();
  if (loader.getExtensions().errors.length > 0)
    throw new Error(`Fixture extension failed: ${JSON.stringify(loader.getExtensions().errors,)}`,);
  /** Actual session manager persists only inside this fixture home. */
  const manager = SessionManager.create(home.cwd, home.sessionDir,);
  /** SDK creates the host used by selection, history, and transport assertions. */
  const { session, } = await createAgentSession({ cwd: home.cwd, agentDir: home.agentDir, modelRuntime: runtime,
    resourceLoader: loader, model: base, noTools: 'builtin', sessionManager: manager, settingsManager: settings,
    scopedModels: [{ model: base, thinkingLevel: 'high', },], },);
  sessions.push(session,);
  await beforeStart?.(runtime,);
  await session.bindExtensions({},);
  // Match CLI service initialization after queued provider and virtual registrations.
  // Availability-only queries can be superseded by registration-triggered cache refreshes.
  await runtime.refresh({ allowNetwork: false, },);
  /** Lifecycle binding must have yielded actual host context and extension API. */
  const { ctx, pi, } = captured;
  if (ctx === undefined || pi === undefined)
    throw new Error('Actual host did not bind the fixture extension.',);
  /**
   * Resume or branch through SDK restoration against the registered catalog.
   *
   * @param sessionManager - actual manager opened from disposable persisted JSONL
   * @returns restored host result without replacing canonical native history
   */
  async function resume(sessionManager: ForeignHostCapability<SessionManager>,): ReturnType<typeof createAgentSession> {
    await loader.reload();
    // Complete native cache/availability initialization before persisted selection resolution.
    await runtime.refresh({ allowNetwork: false, },);
    /** Restoration result retains the real model fallback diagnostic. */
    const result = await createAgentSession({ cwd: home.cwd, agentDir: home.agentDir, modelRuntime: runtime,
      resourceLoader: loader, noTools: 'builtin', sessionManager, settingsManager: settings, },);
    /** Failed binding disposes the partially restored session immediately. */
    using restoration = {
      transferred: false,
      [Symbol.dispose]: function dispose(): void {
        if (!this.transferred)
          result.session.dispose();
      },
    };
    await result.session.bindExtensions({},);
    // Await the same complete initialization used by the real CLI after reload.
    await runtime.refresh({ allowNetwork: false, },);
    sessions.push(result.session,);
    restoration.transferred = true;
    return result;
  }
  initialization.transferred = true;
  return {
    session, manager, runtime, settings, ctx, pi, source, credentials, base, resume, original: effective,
    [Symbol.dispose]: function dispose(): void { for (const active of sessions) active.dispose(); },
  };
}

/**
 * Obtain actual registration capabilities without lazy plugin synchronization.
 *
 * @param home - disposable host storage
 * @returns host with native provider but no installed fast plugin
 * @example
 * ```ts
 * using host = await fixtureRegistrationHost({ home });
 * ```
 */
export async function fixtureRegistrationHost({ home, }: { readonly home: FixtureHome; },): Promise<FixtureHost> {
  return await fixtureHost({ home, register: function noRegistration(): void {
    // Registration-only scenarios deliberately install no priority adapter or aliases.
  }, },);
}

/**
 * Resolve genuine native virtual selection, never similarly named targets.
 *
 * @param runtime - actual pi registry providing virtual entries
 * @param id - original native model ID of the companion
 * @returns checked virtual companion
 * @throws Error when companion is absent or is not virtual
 * @example
 * ```ts
 * const fast = requireCompanion({ runtime: host.runtime, id: host.base.id });
 * ```
 */
export function requireCompanion({ runtime, id, }: { readonly runtime: ForeignHostCapability<ModelRuntime>; readonly id: string; },): Model<Api> {
  /** Catalog lookup distinguishes virtual selection from physical routing ID. */
  const companion = runtime.getModel(FAST_PROVIDER, id,);
  if (companion === undefined || companion.api !== 'pi-virtual')
    throw new Error('Expected a genuine native pi virtual companion.',);
  return companion;
}

//endregion Real host
