/**
 Native registry ownership and canonical reservations are exercised through the emitted lifecycle.

 @module
 */
import { describe, expect, it } from '@monochromatic-dev/module-test/ts';

/** Independent consumer contract permits disposable native identity objects. */
type RegistryModule = {
  readonly createNativeManagerRegistry: (input: {
    readonly owner: { readonly assertOwned: (manager: object) => void };
    readonly sessionOwner: { readonly assertOwned: (pair: unknown) => void };
    readonly readRootOccurrence: (pair: unknown) => object;
    readonly trace: (event: string) => void;
    readonly accounting: {
      registryRequests: number;
      returnedRegistries: number;
      canonicalManagerStatesCreated: number;
      reusedCanonicalStateBinds: number;
    };
  }) => {
    readonly lifecycle: {
      readonly beginConstruction: (input: { readonly manager: object }) => object;
      readonly abandonConstruction: (construction: object) => unknown;
    };
  };
};

/**
 Require the emitted export before exercising the independently described runtime boundary.

 @param value - generated native module namespace
 @returns assertion exposing the built registry constructor
 @throws Error when the artifact omits its registry constructor
 */
function assertRegistryModule(value: unknown): asserts value is RegistryModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createNativeManagerRegistry' in value))
    || ((typeof value.createNativeManagerRegistry) !== 'function'))
    throw new Error('Built native manager registry is unavailable');
}

/** Native staging emits this exact module for the host. */
const built: unknown = await import(new URL(
  '../dist/native/contract/lifecycle/root-lifecycle-retirement-entry/registry.ts', import.meta.url,
).href);
assertRegistryModule(built);

/**
 Create an independently owned manager boundary without constructing real SDK state.

 @returns test-local callbacks and accounting retained by the emitted registry
 */
function fixture() {
  /** Every test controls its own ownership changes. */
  const owned = new Set<object>();
  /** Exact callback arguments demonstrate authentication on every access. */
  const accesses: object[] = [];
  /** Failure identity must survive the registry boundary. */
  const failure = new TypeError('Manager is outside the original constructor owner');
  /** Session reading is not required to reserve an owned manager. */
  const downstream: unknown[] = [];
  /** Counters start at nonzero values to detect accidental replacement or reset. */
  const accounting = {
    registryRequests: 7, returnedRegistries: 5,
    canonicalManagerStatesCreated: 11, reusedCanonicalStateBinds: 13,
  };
  /** Lifecycle callbacks belong to this fixture alone. */
  const definition = {
    owner: { assertOwned(manager: object) {
      accesses.push(manager);
      if (!owned.has(manager)) throw failure;
    } },
    sessionOwner: { assertOwned(pair: unknown) { downstream.push(pair); } },
    readRootOccurrence(pair: unknown) { downstream.push(pair);
    return Object.freeze({}); },
    trace(event: string) { downstream.push(event); },
    accounting,
  };
  return { owned, accesses, failure, downstream, accounting, definition };
}

//region Canonical reservations authenticate original identity and remain registry-local

await describe({ name: '', children: [
  it({ name: 'shares reservations for one manager and isolates distinct managers and registries', fn: async function reservations() {
    /** Both registries deliberately share one constructor owner and accounting object. */
    const input = fixture();
    /** Equal object contents must not merge native identity. */
    const first = {};
    /** Distinct native identity receives an independent reservation. */
    const second = {};
    input.owned.add(first);
    input.owned.add(second);
    /** The exported surface is immutable without freezing borrowed managers. */
    const registry = built.createNativeManagerRegistry(input.definition);
    expect(Object.keys(registry)).toEqual(['lifecycle']);
    expect(Object.isFrozen(registry)).toBe(true);
    expect(input.accounting).toEqual({ registryRequests: 8, returnedRegistries: 6,
      canonicalManagerStatesCreated: 11, reusedCanonicalStateBinds: 13 });
    /** Reservation success positively controls the duplicate rejection. */
    const pending = registry.lifecycle.beginConstruction({ manager: first });
    expect(Object.isFrozen(pending)).toBe(true);
    expect(function duplicate() { return registry.lifecycle.beginConstruction({ manager: first }); })
      .toThrow('Manager already has a pending construction');
    /** A different manager can be reserved during the first reservation. */
    const separate = registry.lifecycle.beginConstruction({ manager: second });
    /** A different registry never shares canonical records or construction handles. */
    const other = built.createNativeManagerRegistry(input.definition);
    /** The same manager can be reserved independently by its second registry. */
    const independent = other.lifecycle.beginConstruction({ manager: first });
    expect(function foreignHandle() { return other.lifecycle.abandonConstruction(pending); })
      .toThrow('Construction occurrence belongs to another lifecycle');
    registry.lifecycle.abandonConstruction(pending);
    /** Reuse after release must consult and retain the original canonical record. */
    const reused = registry.lifecycle.beginConstruction({ manager: first });
    expect(reused).not.toBe(pending);
    registry.lifecycle.abandonConstruction(reused);
    registry.lifecycle.abandonConstruction(separate);
    other.lifecycle.abandonConstruction(independent);
    expect(input.accounting).toEqual({ registryRequests: 9, returnedRegistries: 7,
      canonicalManagerStatesCreated: 14, reusedCanonicalStateBinds: 15 });
    expect(input.accesses).toEqual([first, first, second, first, first]);
    expect(Object.isFrozen(first)).toBe(false);
    expect(Object.isFrozen(second)).toBe(false);
  } }),
  ...[false, true].map(function ownershipCase(previouslyOwned) {
    return it({ name: `rejects ${previouslyOwned ? 'revoked' : 'foreign'} ownership before canonical accounting`,
      fn: async function ownership(ctx) {
        ctx.expect.assertions(5);
        /** An original failure must propagate even when a canonical record already exists. */
        const input = fixture();
        /** Revocation changes membership without replacing the original object. */
        const manager = {};
        /** This registry is the only owner of its canonical manager records. */
        const registry = built.createNativeManagerRegistry(input.definition);
        if (previouslyOwned) {
          input.owned.add(manager);
          registry.lifecycle.abandonConstruction(registry.lifecycle.beginConstruction({ manager }));
          input.owned.delete(manager);
        }
        /** Rejected access cannot create or increment canonical-state accounting. */
        const before = { ...input.accounting };
        try { registry.lifecycle.beginConstruction({ manager }); }
        catch (error) { ctx.expect(error).toBe(input.failure); }
        ctx.expect(input.accounting).toEqual(before);
        ctx.expect(input.accesses).toEqual(previouslyOwned ? [manager, manager] : [manager]);
        input.owned.add(manager);
        /** Positive control proves rejection did not leave a reservation behind. */
        const allowed = registry.lifecycle.beginConstruction({ manager });
        ctx.expect(Object.isFrozen(allowed)).toBe(true);
        registry.lifecycle.abandonConstruction(allowed);
        ctx.expect(input.accounting).toEqual({ ...before,
          canonicalManagerStatesCreated: before.canonicalManagerStatesCreated + (previouslyOwned ? 0 : 1),
          reusedCanonicalStateBinds: before.reusedCanonicalStateBinds + (previouslyOwned ? 1 : 0) });
      } });
  }),
] });

//endregion Canonical reservations authenticate original identity and remain registry-local
