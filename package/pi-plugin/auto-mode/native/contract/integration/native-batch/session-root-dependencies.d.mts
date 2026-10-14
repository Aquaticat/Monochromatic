/**
 Consumer interfaces describe existing lifecycle owners without replacing their identity checks.

 @module
 */
import type { AgentSession, CreateAgentSessionResult, SessionManager } from '@earendil-works/pi-coding-agent';
import type { ManagerConstructorOwner } from '../../lifecycle/runtime-custody/manager-types.ts';
import type { RootSessionLifecycle, RootSessionScope } from './session-root-types.ts';

/** Native private-state readers authenticate the exact session and manager pairing. */
export function createSessionRootReader(input: {
  readonly readActiveSessionManager: (session: AgentSession) => SessionManager;
  readonly readManagerOccurrence: (manager: SessionManager) => object;
}): (input: { readonly session: AgentSession; readonly manager: SessionManager }) => object;

/** Lifecycle construction uses existing constructor ownership and original root occurrences. */
export function createNativeManagerRegistry(input: {
  readonly owner: ManagerConstructorOwner;
  readonly sessionOwner: {
    readonly assertOwned: (input: { readonly session: AgentSession; readonly manager: SessionManager }) => void;
  };
  readonly readRootOccurrence: (input: { readonly session: AgentSession; readonly manager: SessionManager }) => object;
  readonly trace: (event: string) => void;
  readonly accounting: {
    registryRequests: number;
    returnedRegistries: number;
    canonicalManagerStatesCreated: number;
    reusedCanonicalStateBinds: number;
  };
}): { readonly lifecycle: RootSessionLifecycle };

/** Failed construction remains retryable through the original scope owner. */
export function createRuntimeFactoryScopes(input: {
  readonly lifecycle: RootSessionLifecycle;
  readonly readManager: (session: AgentSession) => SessionManager;
  readonly prepareResult: (result: CreateAgentSessionResult) => Readonly<CreateAgentSessionResult>;
  readonly assertRuntimeResult: (result: Readonly<CreateAgentSessionResult>) => void;
  readonly disposeSession: (session: AgentSession) => void;
}): {
  readonly begin: (input: { readonly manager: SessionManager }) => RootSessionScope;
  readonly retryCleanup: () => void;
  readonly diagnostics: () => { readonly pendingCleanup: number };
};
