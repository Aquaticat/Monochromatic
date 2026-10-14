/**
 Keep one canonical epoch per original native manager within each construction registry.

 @module
 */
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createLifecyclePath } from './lifecycle.mjs';
import type {
  NativeManagerEpoch,
  NativeManagerRegistry,
  NativeManagerRegistryDefinition,
} from './registry-types.ts';

/** Registry diagnostics never serialize native manager objects. */
const l = tagged({ tag: 'auto-mode-native-manager-registry' });

//region Canonical manager identity supplies epochs without creating instruction authority

/**
 Bind constructor-owned managers to the incumbent root lifecycle.

 @param owner - original constructor owner authenticating every manager access
 @param sessionOwner - original session registration checked by the lifecycle
 @param readRootOccurrence - native currentness reader for the exact registered pairing
 @param trace - lifecycle diagnostics whose failures remain isolated by that owner
 @param accounting - original factory counters retained across manager reuse

 @returns registry-local lifecycle retaining original lease and transition ownership

 @throws original constructor-owner failure before allocating a foreign manager state

 @example
 ```ts
 const registry = createNativeManagerRegistry(nativeDefinition);
 const construction = registry.lifecycle.beginConstruction({ manager });
 ```
 */
export function createNativeManagerRegistry({
  owner,
  sessionOwner,
  readRootOccurrence,
  trace,
  accounting,
}: NativeManagerRegistryDefinition): NativeManagerRegistry {
  /** Each registry has an independent diagnostic and canonical-state lifetime. */
  const fl = tagged({ tag: createNativeManagerRegistry.name, l });
  /** Native manager identity, not session IDs or matching values, selects canonical state. */
  const states = new WeakMap<SessionManager, NativeManagerEpoch>();
  accounting.registryRequests += 1;
  fl.debug('creating original native manager lifecycle registry');

  /**
   Authenticate the original manager before creating or reusing its canonical epoch.

   @param manager - exact object emitted by the original constructor owner
   @returns existing registry-local state or its first owned epoch record
   @throws original constructor-owner failure before state or counter mutation
   */
  function stateFor(manager: SessionManager): NativeManagerEpoch {
    /** Canonical-state access is a separate diagnostic boundary. */
    const sl = tagged({ tag: stateFor.name, l: fl });
    owner.assertOwned(manager);
    /** The incumbent lifecycle mutates this same record across all manager uses. */
    const existing = states.get(manager);
    if (existing !== undefined) {
      accounting.reusedCanonicalStateBinds += 1;
      sl.debug('reusing original native manager epoch');
      return existing;
    }
    /** A new manager starts with an independent original epoch. */
    const state = { epoch: 0 };
    states.set(manager, state);
    accounting.canonicalManagerStatesCreated += 1;
    sl.debug('created original native manager epoch');
    return state;
  }

  /** Lease and transition identity remain with the existing lifecycle owner. */
  const lifecycle = createLifecyclePath({ stateFor, sessionOwner, trace, readRootOccurrence });
  accounting.returnedRegistries += 1;
  fl.debug('publishing original native manager lifecycle registry');
  return Object.freeze({ lifecycle });
}

//endregion Canonical manager identity supplies epochs without creating instruction authority
