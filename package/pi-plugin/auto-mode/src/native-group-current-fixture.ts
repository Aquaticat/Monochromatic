/**
 Independent original currentness consumers expose callback order and state publication. @module
 */
import assert from 'node:assert/strict';

/**
 Currentness callbacks may publish new original state or throw opaque values.
 */
type CurrentFixtureState = {
  primary?: object;
  closed: boolean;
  phase: string;
  view: object;
  failAt?: string;
  failure: unknown;
  mutateAt?: string;
  mutate?: () => void
};
/**
 Original currentness operations remain independently callable.
 */
type CurrentFixtureOwner = Readonly<{
  current: () => void;
  checkAbort: (input: Readonly<{
    observed: AbortSignal;
    at: string
  }>) => void;
  onParentAbort: () => void;
}>;
/**
 Fixture-owned callback inputs retain original values and observation labels.
 */
type CurrentRecorded = Readonly<{
  error: unknown;
  at: string
}>;
/**
 Cancellation input records the original signal independently of its current reason.
 */
type CurrentAborted = Readonly<{
  observed: AbortSignal;
  at: string
}>;
/**
 Dynamic consumer contract shares no declarations with production currentness code.
 */
type CurrentFixtureModule = Readonly<{ createGroupCurrent: (input: Readonly<{
  group: object;
  view: object;
  signal: AbortSignal;
  groupState: CurrentFixtureState;
  records: readonly Readonly<{ completion: unknown }>[];
  readGroup: (group: object) => object;
  assertParentCurrent: () => void;
  recordFailure: (input: CurrentRecorded) => object;
  abortOccurrence: (input: CurrentAborted) => object
}>) => CurrentFixtureOwner }>;
/**
 Fixture keeps original state and independent callback observations available to consumers.
 */
type CurrentFixture = Readonly<{
  state: CurrentFixtureState;
  controller: AbortController;
  records: { completion: unknown }[];
  events: string[];
  recorded: CurrentRecorded[];
  aborted: CurrentAborted[];
  recordedToken: object;
  abortedToken: object;
  owner: CurrentFixtureOwner
}>;
/** Require the built currentness factory before observing its original boundaries.
 @param value - native built namespace
 
 @returns assertion exposing independently declared currentness operations
 
 @throws Error when the original currentness factory is absent
 */
function assertCurrentModule(value: unknown): asserts value is CurrentFixtureModule {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createGroupCurrent' in value))
    || ((typeof value.createGroupCurrent) !== 'function')) throw new Error('Built original collector currentness is unavailable');
}
/**
 Dynamic module loading prevents production declarations from dictating the fixture's assertions.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/group-current.ts',
  import.meta.url
).href);
assertCurrentModule(loaded);
/**
 Explicit narrowing survives delayed fixture creation.
 */
const currentModule: CurrentFixtureModule = loaded;

//region Callback observations retain original receivers, ordering, and caught values.
/** Build independent native state whose callbacks can change collection eligibility.
 @returns caller-controlled original currentness observations
 
 @example createCurrentFixture();
 */
export function createCurrentFixture(): CurrentFixture {
  /**
   Group handle is distinct from its original view.
   */
  const group = Object.freeze({ original: 'group' });
  /**
   Reader must return this exact object after original parent currentness succeeds.
   */
  const view = Object.freeze({ original: 'view' });
  /**
   Mutable state supports original callback publication and reader replacement.
   */
  const state: CurrentFixtureState = {
    closed: false,
    phase: 'collecting',
    view,
    failure: Object.freeze({ original: 'callback failure' })
  };
  /**
   Signal cancellation is driven by the consumer at original callback boundaries.
   */
  const controller = new AbortController();
  /**
   Partial completion remains distinguishable from complete retained native observation.
   */
  const records: { completion: unknown }[] = [
    { completion: undefined },
    { completion: undefined }
  ];
  /**
   Callback ordering is independent of production diagnostics.
   */
  const events: string[] = [];
  /**
   Newly caught values retain their exact original identity.
   */
  const recorded: CurrentRecorded[] = [];
  /**
   Cancellation observations retain their original source and boundary.
   */
  const aborted: CurrentAborted[] = [];
  /**
   Failure callback returns a stable independently owned token.
   */
  const recordedToken = Object.freeze({ original: 'recorded token' });
  /**
   Cancellation callback returns a different independently owned token.
   */
  const abortedToken = Object.freeze({ original: 'aborted token' });
  /** Observe one callback before performing its optional state publication or failure.
   @param point - original callback boundary
   
   @throws Error when the fixture chooses a failing callback
   */
  function step(point: string): void {
    events.push(point);
    if (state.mutateAt === point) state.mutate?.();
    if (state.failAt === point) throw state.failure;
  }
  /**
   Construction itself must not invoke original currentness callbacks.
   */
  const owner = currentModule.createGroupCurrent({
    group,
    view,
    signal: controller.signal,
    groupState: state,
    records,
    assertParentCurrent(): void { 
      assert.equal(
        this,
        undefined
      ); 
      step('parent'); 
    },
    readGroup(original): object { 
      assert.equal(
        this,
        undefined
      ); 
      assert.equal(
        original,
        group
      ); 
      step('read'); 
      return state.view; 
    },
    recordFailure(input): object { 
      assert.equal(
        this,
        undefined
      ); 
      recorded.push(input); 
      step('record'); 
      return recordedToken; 
    },
    abortOccurrence(input): object { 
      assert.equal(
        this,
        undefined
      ); 
      aborted.push(input); 
      step('abort'); 
      return abortedToken; 
    },
  });
  return {
    state,
    controller,
    records,
    events,
    recorded,
    aborted,
    recordedToken,
    abortedToken,
    owner
  };
}
//endregion
