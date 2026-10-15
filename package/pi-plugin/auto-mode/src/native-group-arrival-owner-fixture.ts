/**
 Independent arrival owners separate failure retention from transport rejection. @module
 */
import assert from 'node:assert/strict';

/**
 Independent record exposes only original arrival-owned mutable transport.
 */
type ArrivalOwnerRecord = {
  member: Readonly<{ argsJSON: string }>;
  arrival: string;
  state: string;
  ticket?: PromiseWithResolvers<unknown>;
  signal?: AbortSignal;
  removeAbort?: () => void;
  completion: unknown;
};
/**
 Original owner state can be published independently by currentness callbacks.
 */
type ArrivalOwnerState = {
  checking: boolean;
  closed: boolean;
  phase: string;
  primary: unknown
};
/**
 Retention remains independent from any delivery effect in this consumer contract.
 */
type ArrivalOwnerFailure = Readonly<{
  error: unknown;
  at: string
}>;
/**
 Original arrival callback boundary does not import production declarations.
 */
type ArrivalOwner = Readonly<{ invoke: (input: Readonly<{
  record: ArrivalOwnerRecord;
  args: unknown;
  nativeSignal: unknown
}>) => Promise<unknown> }>;
/**
 Independent constructor can leave failure retention free of transport side effects.
 */
type ArrivalOwnerModule = Readonly<{ createGroupArrival: (input: Readonly<{
  signal: AbortSignal;
  controller: AbortController;
  records: readonly ArrivalOwnerRecord[];
  groupState: ArrivalOwnerState;
  current: () => void;
  checkAbort: (input: Readonly<{
    observed: AbortSignal;
    at: string
  }>) => void;
  onParentAbort: () => void;
  abortOccurrence: (input: Readonly<{
    observed: AbortSignal;
    at: string
  }>) => void;
  retainBoundaryFailure: (input: ArrivalOwnerFailure) => Readonly<{ occurrence: ArrivalOwnerFailure }>;
  rejectPending: (input: Readonly<{
    error: unknown;
    state: string
  }>) => void;
  startDispatch: () => void;
}>) => ArrivalOwner }>;
/**
 Fixture observations distinguish retained failures, pending delivery, and dispatch callbacks.
 */
type ArrivalOwnerFixture = Readonly<{
  state: ArrivalOwnerState;
  record: ArrivalOwnerRecord;
  native: AbortController;
  events: string[];
  retained: ArrivalOwnerFailure[];
  control: {
    throwAt?: string;
    failure: unknown;
    current?: () => void
  };
  owner: ArrivalOwner;
}>;
/** Require the built arrival operation before consuming its independent callback boundary.
 @param value - built native module namespace
 
 @returns narrowed independent arrival constructor
 
 @throws Error when the original arrival constructor is unavailable
 */
function assertArrivalOwnerModule(value: unknown): asserts value is ArrivalOwnerModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createGroupArrival' in value))
    || ((typeof value.createGroupArrival) !== 'function')) throw new Error('Built original arrival owner is unavailable');
}
/**
 Dynamic module loading prevents production declarations from prescribing the callback assertions.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/group-arrival.ts',
  import.meta.url
).href);
assertArrivalOwnerModule(loaded);
/**
 Explicit narrowing remains available inside delayed fixture construction.
 */
const arrivalModule: ArrivalOwnerModule = loaded;

//region Independent retention deliberately does not reject pending transport as a side effect.
/** Create original arrival inputs whose retention and rejection callbacks remain separately observable.
 @returns independently controlled original arrival consumer
 
 @example createArrivalOwnerFixture();
 */
export function createArrivalOwnerFixture(): ArrivalOwnerFixture {
  /**
   Original parent cancellation remains distinct from member and collector cancellation.
   */
  const parent = new AbortController();
  /**
   Native member signal is independently controllable before and after arrival.
   */
  const native = new AbortController();
  /**
   Original collector state begins before any member callback.
   */
  const state: ArrivalOwnerState = {
    checking: false,
    closed: false,
    phase: 'collecting',
    primary: undefined
  };
  /**
   Original ticket and signal are absent until native admission succeeds.
   */
  const record: ArrivalOwnerRecord = {
    member: Object.freeze({ argsJSON: '{}' }),
    arrival: 'unarrived',
    state: 'unarrived',
    completion: undefined
  };
  /**
   Callback events establish state publication order independently from diagnostics.
   */
  const events: string[] = [];
  /**
   Original caught values remain available independently of delivery rejection.
   */
  const retained: ArrivalOwnerFailure[] = [];
  /**
   Callback failure values remain opaque so primitive and object failures can be retained exactly.
   */
  const control: ArrivalOwnerFixture['control'] = { failure: new Error('original independent callback failure') };
  /** Record a callback before throwing its independently selected original failure.
   @param point - original callback boundary
   
   @throws Error when the independently selected callback fails
   */
  function step(point: string): void {
    events.push(point);
    if (control.throwAt === point) throw control.failure;
  }
  /**
   Original callbacks share the fixture's exact member and mutable transport state.
   */
  const owner = arrivalModule.createGroupArrival({
    signal: parent.signal,
    controller: new AbortController(),
    records: [record],
    groupState: state,
    current(): void { 
      assert.equal(
        this,
        undefined
      ); 
      step('current'); 
      control.current?.(); 
    },
    checkAbort(input): void { 
      assert.equal(
        this,
        undefined
      ); 
      assert.equal(
        input.observed,
        native.signal
      ); 
      assert.equal(
        input.at,
        'native-cancellation'
      ); 
      step('checkAbort'); 
    },
    onParentAbort(): void { 
      assert.equal(
        this,
        undefined
      ); 
      step('parentAbort'); 
    },
    abortOccurrence(input): void { 
      assert.equal(
        this,
        undefined
      ); 
      assert.equal(
        input.observed,
        native.signal
      ); 
      assert.equal(
        input.at,
        'native-cancellation'
      ); 
      step('nativeAbort'); 
    },
    retainBoundaryFailure(input): Readonly<{ occurrence: ArrivalOwnerFailure }> {
      assert.equal(
        this,
        undefined
      );
      assert.equal(
        state.checking,
        false
      );
      retained.push(input);
      step('retain');
      return { occurrence: input };
    },
    rejectPending(input): void {
      assert.equal(
        this,
        undefined
      );
      assert.equal(
        state.checking,
        false
      );
      assert.equal(
        record.state,
        'pending'
      );
      step('reject');
      assert.ok(record.ticket);
      record.state = input.state;
      record.ticket
        .reject(input.error);
    },
    startDispatch(): void {
      assert.equal(
        this,
        undefined
      );
      assert.equal(
        state.checking,
        false
      );
      step('dispatch');
      assert.ok(record.ticket);
      record.ticket
        .resolve('original delivery');
    },
  });
  return {
    state,
    record,
    native,
    events,
    retained,
    control,
    owner
  };
}
//endregion
