/**
 Independent native completion records expose delivery, retention, and listener cleanup order. @module
 */
import assert from 'node:assert/strict';

/**
 Missing record fields retain explicit undefined values until original observation or detachment.
 */
type OptionalFixtureSlots = Readonly<{
  removeAbort?: () => void;
  completion?: Readonly<PromiseSettledResult<unknown>>;
}>;

/**
 Mutable native member state is independent of production type declarations.
 */
export type CompletionFixtureRecord = {
  state: string;
  completion: OptionalFixtureSlots['completion'];
  removeAbort: OptionalFixtureSlots['removeAbort'];
  ticket: Readonly<{
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
  }>;
};

/**
 Each callback can fail with the same independently owned error.
 */
type CompletionFixtureState = {
  closed: boolean;
  primary?: object;
  phase: string;
  failAt?: string;
};

/**
 Original completion owner returns mutable operation publication without freezing its input records.
 */
type CompletionFixtureOwner = Readonly<{
  detach: () => void;
  observeCompletion: (input: Readonly<{
    record: CompletionFixtureRecord;
    completion: unknown
  }>) => Promise<void>;
}>;

/**
 Independent factory contract supplies every native callback from one test fixture.
 */
type CompletionFixtureModule = Readonly<{
  createGroupCompletions: (input: Readonly<{
    groupState: CompletionFixtureState;
    records: readonly CompletionFixtureRecord[];
    signal: AbortSignal;
    onParentAbort: () => void;
  }>) => CompletionFixtureOwner;
}>;

/**
 Complete fixture keeps callback events distinct from original result values.
 */
type CompletionFixture = Readonly<{
  records: readonly CompletionFixtureRecord[];
  record: CompletionFixtureRecord;
  other: CompletionFixtureRecord;
  state: CompletionFixtureState;
  controller: AbortController;
  events: string[];
  deliveries: unknown[];
  failure: Error;
  owner: CompletionFixtureOwner;
}>;

/**
 Require the original native completion factory before exercising its callbacks.

 @param value - built original namespace

 @returns assertion exposing the independent completion consumer contract

 @throws Error when the original factory is missing
 */
function assertCompletionModule(value: unknown): asserts value is CompletionFixtureModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createGroupCompletions' in value))
    || ((typeof value.createGroupCompletions) !== 'function'))
    throw new Error('Built original group completion owner is unavailable');
}

/**
 Stable native bridge is the original collector's consuming boundary.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-collector-completions.mjs',
  import.meta.url,
).href);
assertCompletionModule(loaded);
/**
 Explicit narrowing remains available inside delayed fixture callbacks.
 */
const completionModule: CompletionFixtureModule = loaded;

//region Original fixtures own native tickets, listeners, and every retained record mutation.
/**
 Create independent original records whose callbacks expose retention before delivery.

 @returns original completion owner and mutable fixture observations

 @example createCompletionFixture();
 */
export function createCompletionFixture(): CompletionFixture {
  /**
   Original callback order includes listener cleanup after native retention and delivery.
   */
  const events: string[] = [];
  /**
   Delivery identity remains distinct from mutable diagnostic records.
   */
  const deliveries: unknown[] = [];
  /**
   One exact failure is used to test each original callback boundary.
   */
  const failure = new Error('Original group completion callback failed');
  /**
   Closed and failed groups retain results without publishing settled transport state.
   */
  const state: CompletionFixtureState = {
    closed: false,
    phase: 'dispatching'
  };
  /**
   Parent listener must be detached by identity when all observations complete.
   */
  const controller = new AbortController();
  /**
   Record one original callback before injecting an optional failure.

   @param point - original completion boundary

   @throws Error when the selected original callback fails
   */
  function step(point: string): void {
    events.push(point);
    if (state.failAt === point) throw failure;
  }
  /**
   Original parent listener is installed by the collector before this owner is constructed.
   */
  function onParentAbort(): void {
    step('parent-abort');
  }
  controller.signal
    .addEventListener(
      'abort',
      onParentAbort,
    );
  /**
   Unrelated cancellation listener proves that an abort event was actually dispatched.
   */
  function independentAbort(): void {
    step('independent-abort');
  }
  controller.signal
    .addEventListener(
      'abort',
      independentAbort,
    );
  /**
   Build one original pending member without sharing tickets between records.

   @param label - fixture-only member identity

   @returns mutable original member retaining exact callback receivers
   */
  function createRecord(label: string): CompletionFixtureRecord {
    /**
     The callback resolves only after the original retained result and state are visible.
     */
    const ticket: CompletionFixtureRecord['ticket'] = {
      resolve(value): void {
        assert.equal(
          this,
          ticket
        );
        assert.equal(
          record.state,
          'fulfilled'
        );
        assert.deepEqual(
          record.completion,
          {
            status: 'fulfilled',
            value,
          }
        );
        assert.equal(
          Object.isFrozen(record.completion),
          true
        );
        deliveries.push(value);
        step(`${label}.resolve`);
      },
      reject(error): void {
        assert.equal(
          this,
          ticket
        );
        assert.equal(
          record.state,
          'rejected'
        );
        assert.deepEqual(
          record.completion,
          {
            status: 'rejected',
            reason: error,
          }
        );
        assert.equal(
          Object.isFrozen(record.completion),
          true
        );
        deliveries.push(error);
        step(`${label}.reject`);
      },
    };
    /**
     Original record fields are initialized before any ticket or cleanup callback can run.
     */
    const record: CompletionFixtureRecord = {
      state: 'pending',
      completion: undefined,
      removeAbort(): void {
        assert.equal(
          this,
          record
        );
        step(`${label}.remove`);
      },
      ticket,
    };
    return record;
  }
  /**
   First record exposes an incomplete group after its result settles.
   */
  const record = createRecord('first');
  /**
   Second result supplies the transition from partial observation to full cleanup.
   */
  const other = createRecord('second');
  /**
   Original declaration order determines listener detachment order.
   */
  const records = [
    record,
    other
  ];
  /**
   Construction itself must not read or detach original listeners.
   */
  const owner = completionModule.createGroupCompletions({
    groupState: state,
    records,
    signal: controller.signal,
    onParentAbort
  });
  return {
    records,
    record,
    other,
    state,
    controller,
    events,
    deliveries,
    failure,
    owner
  };
}
//endregion
