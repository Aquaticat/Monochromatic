/**
 Sequential transport attempts share the original judgment's cancellation and accounting.
 @module
 */
import {
  JudgmentAttemptLimitError,
  JudgmentBudgetError
} from './errors.ts';
import {createBundleDispatcher} from './bundles.ts';
import type {
  JudgmentAccounting,
  JudgmentBundleOperation,
  JudgmentAttemptRecord,
  JudgmentBudget,
  JudgmentBudgetInput,
  JudgmentOperation
} from './types.ts';

//region Classification of an actual failed transport attempt gates the next invocation.
/**
 Shared client-attempt allowance across all dispatches in one judgment.
 */
const attemptLimit=3;

/**
 Bind transport dispatch to its original clock and retained accounting.
 
 @param checkpoint - original lifetime check
 
 @param isRetryableTransportFailure - fixed classification of actual failed transport
 
 @param accounting - original shared accounting owner
 
 @param records - original attempt record collection
 
 @param deadlineAt - original absolute expiry
 
 @param signal - original cancellation
 
 @returns transport operation preserving its response type
 
 @example
 ```ts
 const dispatch = createJudgmentDispatcher({
   checkpoint, isRetryableTransportFailure, accounting, records, deadlineAt, signal,
 });
 await dispatch(sendOriginalRequest);
 ```
 */
export function createJudgmentDispatcher({
  checkpoint,
  isRetryableTransportFailure,
  accounting,
  records,
  deadlineAt,
  signal
}: {
  readonly checkpoint: () => number;
  readonly isRetryableTransportFailure: JudgmentBudgetInput['isRetryableTransportFailure'];
  readonly accounting: JudgmentAccounting;
  readonly records: Map<number,JudgmentAttemptRecord>;
  readonly deadlineAt: number;
  readonly signal: AbortSignal;
}): JudgmentBudget['dispatch'] {
  /** Original judgment counters are shared by every active dispatch capability. */
  const runBundle=createBundleDispatcher({accounting,checkpoint,signal,deadlineAt});
  /**
   Check lifetime after a failed attempt without replacing its original error.
   
   @param error - original transport failure
   */
  function retainFailureAtCheckpoint(error: unknown): void {
    /**
     Avoid retaining the same terminal failure twice.
     */
    const alreadyRetired=accounting.retired;
    try {
      checkpoint();
    }
    catch(terminal) {
      if(alreadyRetired&&(terminal===error))throw error;
      throw new AggregateError(
      [
        error,
        terminal
      ],
      'Transport failure and judgment boundary failure',
      { cause: terminal }
      );
    }
  }
  /**
   Preserve transport, classifier and boundary failures together.
   
   @param error - original failed attempt
   
   @param classificationError - original classification failure
   */
  function throwClassificationFailure({
    error,
    classificationError
  }: {
    readonly error: unknown;
    readonly classificationError: unknown
  }): never {
    /**
     Preserve errors in their original occurrence order.
     */
    const failures=[
      error,
      classificationError
    ];
    /**
     Only newly observed boundary failures extend this aggregate.
     */
    const alreadyRetired=accounting.retired;
    try {
      checkpoint();
    }
    catch(terminal){
      if((!alreadyRetired)||(!failures.includes(terminal)))failures.push(terminal);
    }
    throw new AggregateError(
      failures,
      'Transport failure and classifier failure'
    );
  }
  /**
   Classify only the original transport failure and retain classifier exceptions separately.
   
   @param error - original failed attempt
   
   @returns fixed transport classifier decision
   */
  function classifyRetry(error: unknown): boolean {
    try {
      return isRetryableTransportFailure(error);
    }
    catch(classificationError) {
      return throwClassificationFailure({
        error,
        classificationError
      });
    }
  }
  /**
   Return only a response completed inside the original attempt and lifetime limits.
   
   @param operation - original transport attempt
   
   @returns response belonging to the completed attempt
   */
  async function dispatch<Result>(operation: JudgmentOperation<Result>): Promise<Result> {
    if(accounting.running||accounting.checking)throw new JudgmentBudgetError('Judgment attempts cannot overlap or reenter');
    if((typeof operation)!=='function')throw new JudgmentBudgetError('Judgment transport operation must be an owned function');
    checkpoint();
    accounting.running=true;
    /**
     Pending transport excludes overlapping dispatch and closure.
     */
    using attemptScope={
      [Symbol.dispose](): void {
        accounting.running=false;
      }
    };
    {
      // At most one retry can occur across every dispatch through this boundary.
      for(let invocation=0;invocation<attemptLimit;invocation+=1){
        checkpoint();
        if(accounting.attempts>=attemptLimit)throw new JudgmentAttemptLimitError('Judgment exhausted its three assessment dispatches');
        accounting.attempts+=1;
        /**
         Original judgment-wide invocation ordinal.
         */
        const attempt=accounting.attempts;
        /**
         This dispatch has already consumed a failed transport invocation.
         */
        const retry=invocation>0;
        records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'started'
          })
        );
        /**
         Only the successful transport path publishes a response field.
         */
        const response: { value?: Result }={};
        /** Saved capabilities cannot enter a subsequent assessment dispatch. */
        const admission={active:true};
        /** Every success, failure, retry, and early return retires this capability. */
        using bundleScope={ [Symbol.dispose](): void {admission.active=false;} };
        /**
         Admit calls only during their originating assessment invocation.

         @param operations - original provider callbacks to run together

         @returns complete ordered bundle responses
         */
        async function ownedRunBundle<Value>(operations: readonly JudgmentBundleOperation<Value>[]): Promise<readonly Value[]> {
          if(!admission.active)throw new JudgmentBudgetError('Call bundle capability belongs to a completed assessment dispatch');
          return await runBundle(operations);
        }
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Original failure classification gates the next attempt; see doc/troubleshooting/pi-sdk-staging.md, "Sequential native judgment retries".
          response.value=await operation(Object.freeze({
          runBundle:ownedRunBundle,
          signal,
          deadlineAt,
          attempt
          }));
        }
        catch(error) {
          records.set(
            attempt,
            Object.freeze({
              attempt,
              retry,
              state:'failed',
              error
            })
          );
          retainFailureAtCheckpoint(error);
          if(accounting.retryUsed||(accounting.attempts>=attemptLimit))throw error;
          /**
           The next attempt depends on classification of this actual failure.
           */
          const retryable=classifyRetry(error);
          if((typeof retryable)!=='boolean')throwClassificationFailure({
            error,
            classificationError:new JudgmentBudgetError('Transport classifier must return a synchronous Boolean')
          });
          retainFailureAtCheckpoint(error);
          if(!retryable)throw error;
          accounting.retryUsed=true;
          continue;
        }
        try {
          checkpoint();
        }
        catch(error){
          records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'discarded',
            error
          })
          );
          throw error;
        }
        records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'succeeded'
          })
        );
        return response.value;
      }
      throw new JudgmentBudgetError('Judgment retry loop ended without an outcome');
    }
  }
  return dispatch;
}
//endregion
