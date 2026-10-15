/**
 Original judgment owns sequential bundles and parallel transport slots. @module
 */
import { JudgmentAttemptLimitError, JudgmentBudgetError } from './errors.ts';
import type { JudgmentAccounting, JudgmentAttempt } from './types.ts';
import {tagged} from '@monochromatic-dev/module-logger/ts';

/** Bundle lifecycle diagnostics omit request and response content. */
const l=tagged({tag:'auto-mode-judgment-bundles'});

//region Bundle admission precedes every parallel transport invocation.
/**
 Bind shared counters to one judgment without renewing its deadline.

 @param accounting - shared lifetime counters
 @param checkpoint - original expiry and cancellation check
 @param signal - original cancellation source
 @param deadlineAt - unchanged preparation-inclusive expiry
 @returns owned parallel dispatch capability
 */
export function createBundleDispatcher({accounting, checkpoint, signal, deadlineAt}: {
 readonly accounting: JudgmentAccounting;
 readonly checkpoint: () => number;
 readonly signal: AbortSignal;
 readonly deadlineAt: number;
}): JudgmentAttempt['runBundle'] {
 /** Pending bundle excludes overlapping reservations within the active dispatch. */
 const state={running:false};
 return async function runBundle<Result>(operations: readonly ((input: {
  readonly signal: AbortSignal;
  readonly deadlineAt: number;
  readonly attempt: number;
 }) => Promise<Result>)[]): Promise<readonly Result[]> {
  /** Bound diagnostics describe accounting without retaining provider data. */
  const rl=tagged({tag:runBundle.name,l});
  rl.debug('checking original bundle admission');
  checkpoint();
  if(!accounting.running || state.running)throw new JudgmentBudgetError('Call bundles require an active nonoverlapping judgment dispatch');
  if(operations.length<1 || operations.length>3)throw new JudgmentAttemptLimitError('A judgment bundle requires one through three parallel calls');
  if(accounting.bundles>=3)throw new JudgmentAttemptLimitError('Judgment exhausted its three sequential call bundles');
  accounting.bundles+=1;
  state.running=true;
  /** Bundle ownership ends only after every sibling invocation settles. */
  using scope={ [Symbol.dispose](): void {state.running=false;} };
  /** A failed sibling cancels remaining transport work without cancelling unrelated sessions. */
  const cancellation=new AbortController();
  /** Both the original caller and sibling failure govern each invocation. */
  const bundleSignal=AbortSignal.any([signal,cancellation.signal]);
  /** All settlements are observed before returning or retaining aggregate failure. */
  const outcomes=await Promise.allSettled(operations.map(async function invoke(operation){
   tagged({tag:invoke.name,l:rl}).debug('entering owned provider call');
   checkpoint();
   bundleSignal.throwIfAborted();
   accounting.calls+=1;
   /** This ordinal counts an actual owned call across every prior bundle. */
   const attempt=accounting.calls;
   try {
    return await operation({signal:bundleSignal,deadlineAt,attempt});
   } catch(error) {
    cancellation.abort(error);
    throw error;
   }
  }));
  /** Failed siblings retain their original rejection values in request order. */
  const failures:unknown[]=[];
  /** Successful values remain private until all siblings and the deadline pass. */
  const values:Result[]=[];
  for(const outcome of outcomes){
   if(outcome.status==='rejected')failures.push(outcome.reason);
   else values.push(outcome.value);
  }
  if(failures.length>0){
   rl.debug('retaining failed bundle without partial assessment');
   throw new AggregateError(failures,'Judgment call bundle failed');
  }
  checkpoint();
  rl.debug('completed original call bundle');
  return values;
 };
}
//endregion
