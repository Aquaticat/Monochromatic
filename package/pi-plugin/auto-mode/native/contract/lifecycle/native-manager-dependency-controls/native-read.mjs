import {
  NativeManagerQualificationCancellationError,
  NativeManagerQualificationDeadlineError
} from './errors.mjs';

//region Capture actual native getter boundaries; constructor-owner reads stay source-derived.
/** Original case and worker clocks remain independent of the parent's clock origin. */
export function assertOriginalClock(accounting) {
  const now = performance.now();
  if (accounting.originalSignal
    .aborted) throw new NativeManagerQualificationCancellationError(accounting.originalSignal
      .reason);
  if ((now >= accounting.originalCaseDeadline) || (now >= accounting.originalWorkerDeadline)) throw new NativeManagerQualificationDeadlineError();
}
/** Native throws survive simultaneous timing or recording failures as primary causes. */
export function readNativeGetter({
  manager,
  method,
  phase,
  label,
  trace,
  accounting
}) {
  trace(`native.${  phase  }.${  label  }.enter`);
  assertOriginalClock(accounting);
  const enteredAt = performance.now();
  accounting.nativeGetterAttempts += 1;
  accounting.nativeGetterRequests
    .push(Object.freeze({
      phase,
      method,
      arguments: [],
      enteredAt
    }));
  let value;
  try {
    value = manager[method]();
  } catch (error) {
    const failedAt = performance.now();
    const failures = [error];
    try { accounting.nativeGetterFailures
      .push(Object.freeze({
        phase,
        method,
        enteredAt,
        failedAt,
        error
      })); }
    catch (recordingError) { failures.push(recordingError); }
    try { assertOriginalClock(accounting); }
    catch (clockError) { failures.push(clockError); }
    if (failures.length > 1) throw new AggregateError(
      failures,
      'Native getter and qualification evidence failures remain primary',
      { cause: error }
    );
    throw error;
  }
  const returnedAt = performance.now();
  accounting.nativeGetterCompletedReturns += 1;
  const returned = value === undefined ? Object.freeze({ kind: 'undefined' }) : Object.freeze({
    kind: 'value',
    value: structuredClone(value)
  });
  accounting.nativeGetterReturns
    .push(Object.freeze({
      phase,
      method,
      enteredAt,
      returnedAt,
      returned
    }));
  trace(`native.${  phase  }.${  label  }.return`);
  assertOriginalClock(accounting);
  return value;
}
//endregion
