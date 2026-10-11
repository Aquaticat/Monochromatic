import {
  type SyntheticClient,
  WritingBenchUnreachableError,
} from '../dist/final/node/index.mjs';
import { untilAborted, } from './stage-trivial-reply.test-fixture.ts';

//region Stop-landing hook
// A PER-SLICE HOOK THAT ENDS THE FIRST TWO SLICES AROUND THE CALLER'S STOP,
// for cases that run a document driver's overlapped lanes and read what is
// written for a slice whose own failure the stop leaves unthrown.
//
// The first call is the first slice's: it waits for the stop and rejects
// with the caller's reason, as a hold wait the caller stops does. The second
// call is the later slice's: it stops the caller, then ends as the case says,
// by a failure of its own or by a seating the driver refuses. So the later
// slice fails of its own first and the first slice ends in the reason after
// it, an order no timer, child or disk decides.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. The failures are invented and cat-themed.

/**
 Refusal a hold reading raises when a writing bench cannot write, which is
 what the pass's own per-slice hook throws (`readJudgeSeats`).
 */
export const BENCH_UNREACHABLE: WritingBenchUnreachableError = new WritingBenchUnreachableError({
  phase: 'lanes',
  clauses: ['tabby editors 0 of 3 reachable, floor 2',],
},);

/**
 Builds the hook, its first call waiting for the stop and its second making
 the stop.

 @param steering - caller's controller, which the second call aborts

 @param reason - why the caller stops

 @param afterStop - how the second call ends once the caller has stopped: a
 throw of the slice's own, or a seating the driver then refuses

 @returns Hook a driver awaits before each slice

 @throws Error on a third call, since a driver whose second slice failed
 starts no further slice

 @example
 ```ts
 const beforeSlice = stopLandingHook({ steering, reason, afterStop: throwBenchUnreachable, },);
 ```
 */
export function stopLandingHook<SeatingT,>(
  {
    steering,
    reason,
    afterStop,
  }: {
    readonly steering: AbortController;
    readonly reason: Error;
    readonly afterStop: () => SeatingT;
  },
): () => Promise<SeatingT> {
  /**
   Calls made so far.
   */
  const calls = { count: 0, };
  return async function beforeSlice(): Promise<SeatingT> {
    calls.count += 1;
    if (calls.count === 1) {
      await untilAborted({ signal: steering.signal, },);
      steering.signal
        .throwIfAborted();
      throw new Error('unreachable: the first slice waited for a stop and its signal had not aborted',);
    }
    if (calls.count === 2) {
      steering.abort(reason,);
      return afterStop();
    }
    throw new Error(
      'unreachable: the hook was called a third time, though the second slice failed and no slice starts after it',
    );
  };
}

/**
 Ends the later slice's hook with the bench refusal.

 @throws {@link WritingBenchUnreachableError} always, as {@link BENCH_UNREACHABLE}

 @example
 ```ts
 const beforeSlice = stopLandingHook({ steering, reason, afterStop: throwBenchUnreachable, },);
 ```
 */
export function throwBenchUnreachable(): never {
  throw BENCH_UNREACHABLE;
}

/**
 Refuses a model exchange a case expects none of, with an error saying a
 slice the hook failed asked a model.

 @example
 ```ts
 await refuseUnaskedExchange();
 ```
 */
function refuseUnaskedExchange(): Promise<never> {
  return Promise.reject(new Error('unreachable: a slice the hook failed asked a model',),);
}

/**
 Client for a driver whose slices all end in their hook before asking
 anybody.
 */
export const UNASKED_CLIENT: SyntheticClient = {
  chatText: refuseUnaskedExchange,
  chatJson: refuseUnaskedExchange,
  quotas: refuseUnaskedExchange,
};

//endregion Stop-landing hook
