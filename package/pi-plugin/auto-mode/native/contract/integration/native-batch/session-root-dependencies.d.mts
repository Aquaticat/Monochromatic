/**
 Consumer interfaces describe existing lifecycle owners without replacing their identity checks.

 @module
 */
import type {
  AgentSession,
  SessionManager
} from '@earendil-works/pi-coding-agent';
import type { ManagerConstructorOwner } from '../../lifecycle/runtime-custody/manager-types.ts';
import type {
  RootSessionLifecycle,
} from './session-root-types.ts';

/** Lifecycle construction uses existing constructor ownership and original root occurrences. */
export function createNativeManagerRegistry(input: {
  readonly owner: ManagerConstructorOwner;
  readonly sessionOwner: {
    readonly assertOwned: (input: {
      readonly session: AgentSession;
      readonly manager: SessionManager
    }) => void;
  };
  readonly readRootOccurrence: (input: {
    readonly session: AgentSession;
    readonly manager: SessionManager
  }) => object;
  readonly trace: (event: string) => void;
  readonly accounting: {
    registryRequests: number;
    returnedRegistries: number;
    canonicalManagerStatesCreated: number;
    reusedCanonicalStateBinds: number;
  };
}): { readonly lifecycle: RootSessionLifecycle };
