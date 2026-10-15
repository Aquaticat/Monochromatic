/**
 Independent failure consumers expose original history, delivery, and cancellation order. @module
 */
import assert from 'node:assert/strict';

/**
 Original occurrence identity remains separate from equality between caught values.
 */
export type FailureOccurrenceFixture = Readonly<{
  identity: object;
  ordinal: number;
  at: string;
  error: unknown
}>;
/**
 Tokens retain their original occurrence without prescribing the implementation's error category.
 */
export type FailureTokenFixture = Error & Readonly<{ occurrence: FailureOccurrenceFixture }>;
/**
 Mutable fixture state exposes publication before callback execution.
 */
type FailureStateFixture = {
  primary?: FailureTokenFixture;
  closed: boolean;
  phase: string;
  failReject: boolean;
  reenter?: () => void
};
/**
 Independent operations describe the stable native consuming boundary.
 */
type FailureOwnerFixture = Readonly<{
  recordFailure: (input: Readonly<{
    error: unknown;
    at: string
  }>) => FailureTokenFixture;
  retainBoundaryFailure: (input: Readonly<{
    error: unknown;
    at: string
  }>) => FailureTokenFixture;
  abortOccurrence: (input: Readonly<{
    observed: AbortSignal;
    at: string
  }>) => FailureTokenFixture;
}>;
/**
 Fixture module accepts independently owned failure state and callbacks.
 */
type FailureModuleFixture = Readonly<{ createGroupFailures: (input: Readonly<{
  groupState: FailureStateFixture;
  failures: FailureOccurrenceFixture[];
  controller: AbortController;
  rejectPending: (input: Readonly<{
    error: unknown;
    state: string
  }>) => void;
}>) => FailureOwnerFixture }>;
/**
 Complete observations retain the actual abort event and original callback error.
 */
type FailureFixture = Readonly<{
  state: FailureStateFixture;
  failures: FailureOccurrenceFixture[];
  controller: AbortController;
  events: string[];
  rejected: unknown[];
  callbackFailure: Error;
  owner: FailureOwnerFixture;
}>;

/** Require the stable built native factory before constructing independent consumers.
 @param value - built namespace
 
 @returns assertion exposing the independent consumer contract
 
 @throws Error when the native failure factory is absent
 */
function assertFailureModule(value: unknown): asserts value is FailureModuleFixture {
  if ((value === null) || ((typeof value) !== 'object')
    || (!('createGroupFailures' in value))
    || ((typeof value.createGroupFailures) !== 'function'))
    throw new Error('Built original group failure owner is unavailable');
}
/**
 Dynamic loading keeps consumer declarations independent of implementation declarations.
 */
const loaded: unknown = await import(new URL(
  '../dist/native/contract/collector/program-rule-batch-sdk-copy-v2/input/program-collector-failures.mjs',
  import.meta.url
).href);
assertFailureModule(loaded);
/**
 Explicit narrowing remains available to delayed fixture construction.
 */
const failureModule: FailureModuleFixture = loaded;

//region Independent callbacks observe original publication order and reentry.
/** Create a fresh native cancellation owner and append-only occurrence history.
 @returns independently observable original failure owner
 
 @example createFailureFixture();
 */
export function createFailureFixture(): FailureFixture {
  /**
   Every delivery and actual abort event is observed independently.
   */
  const events: string[] = [];
  /**
   Exact rejected values remain visible without normalization.
   */
  const rejected: unknown[] = [];
  /**
   Failure records are owned by the caller.
   */
  const failures: FailureOccurrenceFixture[] = [];
  /**
   Native state begins collecting without a primary failure.
   */
  const state: FailureStateFixture = {
    closed: false,
    phase: 'collecting',
    failReject: false
  };
  /**
   Native cancellation delivery exposes ordering after pending rejection.
   */
  const controller = new AbortController();
  /**
   Callback failure differs from every input failure.
   */
  const callbackFailure = new Error('Original pending rejection callback failed');
  controller.signal
    .addEventListener(
      'abort',
      function observeAbort() {
    events.push('abort');
  }
    );
  /**
   Pending delivery must see retained history and failed state before cancellation.

   @param input - original pending delivery rejection
   */
  const rejectPending = function rejectPending(
    this: unknown,
    input: Readonly<{
      error: unknown;
      state: string
    }>
  ): void {
    assert.equal(
      this,
      undefined
    );
    assert.equal(
      state.phase,
      'failed'
    );
    assert.ok(state.primary);
    assert.equal(
      state.primary
        .occurrence,
      failures.at(-1)
    );
    assert.equal(
      state.primary
        .occurrence
        .error,
      input.error
    );
    assert.equal(
      controller.signal
        .aborted,
      false
    );
    assert.equal(
      input.state,
      'rejected'
    );
    rejected.push(input.error);
    events.push('reject');
    state.reenter?.();
    if (state.failReject) throw callbackFailure;
  };
  /**
   Factory construction must leave every observable fixture input unchanged.
   */
  const owner = failureModule.createGroupFailures({
    groupState: state,
    failures,
    controller,
    rejectPending
  });
  return {
    state,
    failures,
    controller,
    events,
    rejected,
    callbackFailure,
    owner
  };
}
//endregion
