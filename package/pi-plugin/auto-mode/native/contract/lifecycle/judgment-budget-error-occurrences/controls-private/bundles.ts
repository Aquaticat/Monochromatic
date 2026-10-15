/**
 Original judgment owns sequential bundles and parallel transport slots. @module
 */
import { JudgmentAttemptLimitError, JudgmentBudgetError } from './errors.ts';
import type { JudgmentAccounting, JudgmentAttempt } from './types.ts';

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
 let running=false;
 return async function runBundle<Result>(operations: readonly ((input: {
  readonly signal: AbortSignal;
  readonly deadlineAt: number;
  readonly attempt: number;
 }) => Promise<Result>)[]): Promise<readonly Result[]> {
  checkpoint();
  if(!accounting.running || running)throw new JudgmentBudgetError('Call bundles require an active nonoverlapping judgment dispatch');
  if(operations.length<1 || operations.length>3)throw new JudgmentAttemptLimitError('A judgment bundle requires one through three parallel calls');
  if(accounting.bundles>=3)throw new JudgmentAttemptLimitError('Judgment exhausted its three sequential call bundles');
  accounting.bundles+=1;
  running=true;
  using scope={ [Symbol.dispose](): void {running=false;} };
  const cancellation=new AbortController();
  const bundleSignal=AbortSignal.any([signal,cancellation.signal]);
  const outcomes=await Promise.allSettled(operations.map(async function invoke(operation){
   checkpoint();
   accounting.calls+=1;
   const attempt=accounting.calls;
   try {
    return await operation({signal:bundleSignal,deadlineAt,attempt});
   } catch(error) {
    cancellation.abort(error);
    throw error;
   }
  }));
  const failures=outcomes.filter(outcome=>outcome.status==='rejected');
  if(failures.length>0)throw new AggregateError(failures.map(outcome=>outcome.reason),'Judgment call bundle failed');
  checkpoint();
  return outcomes.map(function readOutcome(outcome){
   if(outcome.status==='rejected')throw outcome.reason;
   return outcome.value;
  });
 };
}
//endregion
