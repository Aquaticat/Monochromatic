/** Independent collector lifetime consumers observe original retirement and retained snapshots. @module */
import assert from 'node:assert/strict';

/** Original occurrence observations retain opaque caught values. */
type LifetimeOccurrence = Readonly<{ identity: object; ordinal: number; at: string; error: unknown }>;
/** Original members can change after a retained snapshot has been returned. */
type LifetimeMember = { member: { ordinal: number }; arrival: string; state: string; completion?: Readonly<PromiseSettledResult<unknown>> };
/** Mutable fixture state permits callback failures and original work replacement. */
type LifetimeState = {
  closed: boolean; phase: string; phaseAtReturn?: string; primary?: Readonly<{ occurrence: LifetimeOccurrence }>;
  work: Promise<unknown>; dispatches: number; unboundPending: number; unboundOutcomes: unknown[]; failAt?: string;
};
/** Independent inspection contract describes original retained transport output. */
type LifetimeSnapshot = Readonly<{
  phase: string; phaseAtReturn?: string; failed: boolean; failure: unknown; failures: readonly LifetimeOccurrence[];
  dispatches: number; unboundPending: number; unboundOutcomes: readonly unknown[];
  members: readonly Readonly<{ ordinal: number; arrival: string; state: string; completion?: Readonly<PromiseSettledResult<unknown>> }>[];
  executionState: string; effectQualification: string;
}>;
/** Original public lifetime operations are callable without receiver ownership. */
type LifetimeOwner = Readonly<{ retire: () => void; drain: () => Promise<void>; inspect: () => LifetimeSnapshot }>;
/** Factory input is authored independently of implementation types. */
type LifetimeModule = Readonly<{ createGroupLifetime: (input: Readonly<{
  groupState: LifetimeState; records: LifetimeMember[]; failures: LifetimeOccurrence[]; controller: AbortController;
  detach: () => void; recordFailure: (input: Readonly<{ error: unknown; at: string }>) => unknown;
  rejectPending: (input: Readonly<{ error: unknown; state: string }>) => void;
}>) => LifetimeOwner }>;
/** Caller-owned observations expose cleanup, failure retention, cancellation, and actual abort events. */
type LifetimeFixture = Readonly<{
  state: LifetimeState; records: LifetimeMember[]; failures: LifetimeOccurrence[]; controller: AbortController;
  events: string[]; rejected: unknown[]; callbackFailure: Error; owner: LifetimeOwner;
}>;

/** Require the original native lifetime factory before constructing independent fixtures.
 @param value - built module namespace
 @returns assertion exposing the independent consumer contract
 @throws Error when the built factory is missing
 */
function assertLifetimeModule(value: unknown): asserts value is LifetimeModule {
  if ((value === null) || ((typeof value) !== 'object') || (!('createGroupLifetime' in value))
    || ((typeof value.createGroupLifetime) !== 'function')) throw new Error('Built original collector lifetime is unavailable');
}
/** Dynamic namespace import avoids sharing implementation type declarations with the fixture. */
const loaded: unknown = await import(new URL('../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/group-lifetime.ts', import.meta.url).href);
assertLifetimeModule(loaded);
/** Explicit narrowing remains available when later test callbacks construct fixtures. */
const lifetimeModule: LifetimeModule = loaded;

//region Independent lifetime callbacks make original publication ordering observable.
/** Construct original transport state with observable cleanup and cancellation callbacks.
 @returns original lifetime owner and caller-controlled observations
 @example createLifetimeFixture();
 */
export function createLifetimeFixture(): LifetimeFixture {
  /** Event history excludes inspection so later retained reads remain distinguishable from callbacks. */
  const events: string[] = [];
  /** Pending rejection keeps exact original reason identity. */
  const rejected: unknown[] = [];
  /** Failure history remains caller-owned and mutable after inspection. */
  const failures: LifetimeOccurrence[] = [];
  /** Member fixtures differ in ordinal and transport state. */
  const records: LifetimeMember[] = [
    { member: { ordinal: 17 }, arrival: 'matched', state: 'pending' },
    { member: { ordinal: 23 }, arrival: 'unarrived', state: 'unarrived' },
  ];
  /** Native work begins complete and may be replaced by independently controlled pending work. */
  const state: LifetimeState = { closed: false, phase: 'collecting', work: Promise.resolve(), dispatches: 7, unboundPending: 3, unboundOutcomes: [] };
  /** Native cancellation event is observed independently of the cancellation call. */
  const controller = new AbortController();
  /** Callback failure identity is distinct from collector-created failure diagnostics. */
  const callbackFailure = new Error('Original collector lifetime callback failed');
  /** Retain one original callback observation before optionally throwing.
   @param point - original callback boundary selected by the consumer
   @throws Error when the chosen callback fails
   */
  function step(point: string): void {
    events.push(point);
    if (state.failAt === point) throw callbackFailure;
  }
  controller.signal.addEventListener('abort', function actualAbort() { step('abort'); });
  /** Construction binds callbacks without publishing retirement or inspecting original values. */
  const owner = lifetimeModule.createGroupLifetime({
    groupState: state, records, failures, controller,
    detach(): void {
      assert.equal(this, undefined);
      assert.equal(state.closed, false);
      assert.equal(state.phaseAtReturn, undefined);
      step('detach');
    },
    recordFailure({ error, at }): unknown {
      assert.equal(this, undefined);
      assert.equal(state.closed, false);
      assert.equal(state.phaseAtReturn, 'collecting');
      assert.equal(at, 'incomplete-membership-return');
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'DeclaredGroupCollectionError');
      assert.equal(error.message, 'Parent returned before declared membership completed');
      step('record');
      /** Independent callback models only its caller-visible state publication. */
      const occurrence = Object.freeze({ identity: Object.freeze({}), ordinal: failures.length, at, error });
      failures.push(occurrence);
      state.primary = { occurrence };
      state.phase = 'failed';
      return state.primary;
    },
    rejectPending({ error, state: deliveryState }): void {
      assert.equal(this, undefined);
      assert.equal(state.closed, true);
      assert.equal(deliveryState, 'cancelled');
      assert.ok(error instanceof Error);
      assert.equal(error.name, 'DeclaredGroupCollectionError');
      assert.equal(error.message, 'Declared parent group has returned');
      rejected.push(error);
      step('reject');
    },
  });
  return { state, records, failures, controller, events, rejected, callbackFailure, owner };
}
//endregion
