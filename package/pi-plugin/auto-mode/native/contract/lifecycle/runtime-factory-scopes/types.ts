/**
 Original SDK construction retains exact session, result, and lifecycle identities.

 @module
 */
import type { AgentSession, CreateAgentSessionResult, SessionManager } from '@earendil-works/pi-coding-agent';
import type { RootSessionLifecycle, RootSessionScope } from '../../integration/native-batch/session-root-types.ts';

/** Bootstrap supplies the actual SDK result validator and original native readers. */
export type FactoryScopeDefinition = {
  readonly lifecycle: RootSessionLifecycle;
  readonly readManager: (session: AgentSession) => SessionManager;
  readonly prepareResult: (result: CreateAgentSessionResult) => Readonly<CreateAgentSessionResult>;
  readonly assertRuntimeResult: (result: Readonly<CreateAgentSessionResult>) => void;
  readonly disposeSession: (session: AgentSession) => void;
};

/** Construction may attach to an already owned replacement transition. */
export type FactoryScopeInput = {
  readonly manager: SessionManager;
  readonly transition?: object;
};

/** Failed cleanup blocks new construction until every retained obligation completes. */
export type FactoryScopes = {
  readonly begin: (input: FactoryScopeInput) => RootSessionScope;
  readonly retryCleanup: () => void;
  readonly diagnostics: () => { readonly pendingCleanup: number };
};

/** Synchronous callbacks share one factory-wide reentrancy boundary. */
export type FactoryExclusive = <Result>(body: () => Result) => Result;
