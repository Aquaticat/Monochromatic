/**
 Original constructor ownership supplies registry-local manager epochs to the incumbent lifecycle.

 @module
 */
import type {
  AgentSession,
  SessionManager
} from '@earendil-works/pi-coding-agent';
import type { ManagerConstructorOwner } from '../runtime-custody/manager-types.ts';
import type { RootSessionLifecycle } from '../../integration/native-batch/session-root-types.ts';
import type { SessionRootReader } from './root-reader.ts';

/**
 The lifecycle owns later transition fields while the registry owns canonical manager identity.
 */
export type NativeManagerEpoch = {
  /**
   Original manager epoch is shared by leases from this registry only.
   */
  epoch: number;
};

/**
 Registry counters describe original construction work without granting authority.
 */
export type NativeManagerRegistryAccounting = {
  /**
   Every requested registry is counted before lifecycle construction.
   */
  registryRequests: number;
  /**
   Returned registry count changes only after lifecycle construction succeeds.
   */
  returnedRegistries: number;
  /**
   First use of an owned manager creates one canonical epoch record.
   */
  canonicalManagerStatesCreated: number;
  /**
   Later uses of the same original manager reuse its existing record.
   */
  reusedCanonicalStateBinds: number;
};

/**
 Native bootstrap fixes original owner capabilities before any root can be registered.
 */
export type NativeManagerRegistryDefinition = {
  /**
   Original constructor ownership is checked on every canonical state access.
   */
  readonly owner: Pick<ManagerConstructorOwner, 'assertOwned'>;
  /**
   Session registration authenticates the exact native session-manager pairing.
   */
  readonly sessionOwner: {
    readonly assertOwned: (input: {
      readonly session: AgentSession;
      readonly manager: SessionManager;
    }) => void;
  };
  /**
   Currentness comes from the original native reader, never an identifier string.
   */
  readonly readRootOccurrence: SessionRootReader;
  /**
   The incumbent lifecycle owns diagnostic failure isolation.
   */
  readonly trace: (event: string) => void;
  /**
   The original factory retains these mutable counters.
   */
  readonly accounting: NativeManagerRegistryAccounting;
};

/**
 The maintained caller receives only the existing lifecycle, not historical snapshot adapters.
 */
export type NativeManagerRegistry = {
  /**
   Original lease issuance and transition ownership remain with the incumbent lifecycle.
   */
  readonly lifecycle: RootSessionLifecycle;
};
