/**
 Independent dispatch consumers expose original work publication and opaque outcomes. @module
 */
import assert from 'node:assert/strict';

/**
 Fixture state independently records dispatch publication and retained native observations.
 */
export type DispatchFixtureState = {
  primary?: object;
  closed: boolean;
  phase: string;
  dispatches: number;
  work: Promise<void>;
  unboundPending: number;
  unboundOutcomes: readonly Readonly<{
    retainedOnly: true;
    sourceKey: string;
    status: string;
    value?: unknown;
    reason?: unknown
  }>[];
};
/**
 Fixture members retain independently issued identities and native completion slots.
 */
type DispatchFixtureRecord = {
  member: object;
  handle: object;
  arrival: string;
  state: string;
  signal: AbortSignal;
  ticket: PromiseWithResolvers<unknown>;
  completion: unknown;
  removeAbort: undefined;
};
/**
 Independently supplied dispatch input exposes frozen association containers.
 */
type DispatchFixtureCall = Readonly<{
  handle: object;
  declaration: object;
  members: readonly Readonly<{
    handle: object;
    declaration: object;
    signal: AbortSignal
  }>[];
}>;
/**
 Recorded boundary observations preserve the exact caught value.
 */
type DispatchFixtureFailure = Readonly<{
  error: unknown;
  at: string
}>;
/**
 Completion callbacks remain independently controlled rather than sharing production declarations.
 */
type DispatchFixtureObservation = Readonly<{
  record: DispatchFixtureRecord;
  completion: unknown
}>;
/**
 Dynamic consumer declares only the factory boundary exercised by this fixture.
 */
type DispatchFixtureModule = Readonly<{ createGroupDispatch: (input: Readonly<{
  handle: object;
  declaration: object;
  records: readonly DispatchFixtureRecord[];
  groupState: DispatchFixtureState;
  current: () => void;
  dispatchGroup: (input: DispatchFixtureCall) => unknown;
  recordFailure: (input: DispatchFixtureFailure) => Error;
  retainBoundaryFailure: (input: DispatchFixtureFailure) => Error;
  observeCompletion: (input: DispatchFixtureObservation) => Promise<void>;
}>) => Readonly<{ startDispatch: () => void }> }>;
/**
 Fixture controls exercise callback failures and publication without observing log text.
 */
type DispatchFixture = Readonly<{
  state: DispatchFixtureState;
  records: DispatchFixtureRecord[];
  originalWork: Promise<void>;
  events: string[];
  calls: DispatchFixtureCall[];
  observations: DispatchFixtureObservation[];
  failures: DispatchFixtureFailure[];
  retained: DispatchFixtureFailure[];
  failureToken: Error;
  control: {
    returned: unknown;
    currentCalls: number;
    current?: () => void;
    consume?: () => unknown;
    observe?: (input: DispatchFixtureObservation) => Promise<void>;
    retain?: (input: DispatchFixtureFailure) => void;
  };
  owner: Readonly<{ startDispatch: () => void }>;
}>;
/** Require the built dispatcher before consuming its original callback boundaries.
 @param value - built native module namespace
 
 @returns narrowed independent factory contract
 
 @throws Error when the built dispatcher is unavailable
 */
function assertDispatchModule(value: unknown): asserts value is DispatchFixtureModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createGroupDispatch' in value))
    || ((typeof value.createGroupDispatch) !== 'function')) throw new Error('Built original group dispatcher is unavailable');
}
/**
 Built loading prevents production declarations from prescribing fixture expectations.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/group-dispatch.ts',
  import.meta.url
).href);
assertDispatchModule(loaded);
/**
 Explicit narrowing remains available inside delayed fixture construction.
 */
const dispatchModule: DispatchFixtureModule = loaded;

//region Independent callbacks retain original publication, receiver, and opaque value observations.
/** Throw an opaque independently supplied callback failure without normalization.
 @param value - original callback failure whose identity the dispatcher must retain
 @throws Error when the fixture invokes this deliberately failing callback boundary
 @example throwDispatchFixtureValue(originalFailure);
 */
export function throwDispatchFixtureValue(value: unknown): never {
  throw value;
}
/** Create independently mutable original dispatch inputs and callback controls.
 @returns original dispatcher with independently observable native boundaries
 
 @example createDispatchFixture();
 */
export function createDispatchFixture(): DispatchFixture {
  /**
   Original handle and declaration remain distinct independently allocated identities.
   */
  const handle = Object.freeze({ original: 'handle' });
  /**
   Declaration contents remain opaque to original dispatch.
   */
  const declaration = Object.freeze({ original: 'declaration' });
  /**
   Existing work must be replaced before callbacks can inspect or drain dispatch.
   */
  const originalWork = Promise.resolve();
  /**
   Original mutable state begins before dispatch publication.
   */
  const state: DispatchFixtureState = {
    closed: false,
    phase: 'collecting',
    dispatches: 0,
    work: originalWork,
    unboundPending: 0,
    unboundOutcomes: Object.freeze([])
  };
  /**
   Independent members already own tickets before their matched arrival is published.
   */
  const records = [
    0,
    1
  ].map(function member(ordinal): DispatchFixtureRecord {
    return {
      member: Object.freeze({ ordinal }),
      handle: Object.freeze({ ordinal }),
      arrival: 'matched',
      state: 'pending',
      signal: new AbortController().signal,
      ticket: Promise.withResolvers<unknown>(),
      completion: undefined,
      removeAbort: undefined
    };
  });
  /**
   Callback ordering is measured independently of production diagnostics.
   */
  const events: string[] = [];
  /**
   Complete consumer inputs preserve original member associations.
   */
  const calls: DispatchFixtureCall[] = [];
  /**
   Observations retain original completion and record identities.
   */
  const observations: DispatchFixtureObservation[] = [];
  /**
   New failure observations are distinct from boundary propagation.
   */
  const failures: DispatchFixtureFailure[] = [];
  /**
   Boundary propagation may retain an already published failure token.
   */
  const retained: DispatchFixtureFailure[] = [];
  /**
   Fixture token does not inspect or normalize an original failure value.
   */
  const failureToken = new Error('original recorded failure token');
  /**
   Mutable callback controls can synchronously reenter publication observations.
   */
  const control: DispatchFixture['control'] = {
    returned: [
      undefined,
      undefined
    ],
    currentCalls: 0
  };
  /**
   Factory creation itself must not invoke any original native callback.
   */
  const owner = dispatchModule.createGroupDispatch({
    handle,
    declaration,
    records,
    groupState: state,
    current(): void {
      assert.equal(
        this,
        undefined
      );
      events.push('current');
      control.currentCalls++;
      control.current?.();
    },
    dispatchGroup(input): unknown {
      assert.equal(
        this,
        undefined
      );
      assert.equal(
        input.handle,
        handle
      );
      assert.equal(
        input.declaration,
        declaration
      );
      assert.equal(
        state.phase,
        'dispatching'
      );
      assert.equal(
        state.dispatches,
        calls.length + 1
      );
      events.push('consumer');
      calls.push(input);
      if (control.consume) return control.consume();
      return control.returned;
    },
    recordFailure(input): Error {
      assert.equal(
        this,
        undefined
      );
      events.push(input.at);
      failures.push(input);
      state.primary ??= failureToken;
      state.phase = 'failed';
      return failureToken;
    },
    retainBoundaryFailure(input): Error {
      assert.equal(
        this,
        undefined
      );
      events.push(input.at);
      retained.push(input);
      control.retain?.(input);
      return failureToken;
    },
    async observeCompletion(input): Promise<void> {
      assert.equal(
        this,
        undefined
      );
      events.push('observe');
      observations.push(input);
      if (control.observe) await control.observe(input);
    },
  });
  return {
    state,
    records,
    originalWork,
    events,
    calls,
    observations,
    failures,
    retained,
    failureToken,
    control,
    owner
  };
}
//endregion
