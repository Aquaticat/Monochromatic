/**
 Original preparation-inclusive judgment lifetime and transport accounting.
 @module
 */
import type {
  JudgmentAttemptRecord,
  JudgmentBudget,
  JudgmentBudgetInput,
  JudgmentBudgetSnapshot,
  JudgmentOperation
} from './types.ts';
import {
  JudgmentAttemptLimitError,
  JudgmentBudgetError,
  JudgmentCancelledError,
  JudgmentDeadlineError
} from './errors.ts';

export {
  JudgmentAttemptLimitError,
  JudgmentBudgetError,
  JudgmentCancelledError,
  JudgmentDeadlineError
} from './errors.ts';

//region Cooperative accounting for one enclosing judgment, never a permission or execution lease.
/** Original preparation-inclusive duration in milliseconds. */
const durationMs = 5_000;
/** Shared client-attempt allowance across all dispatches in one judgment. */
const attemptLimit = 3;

/**
 Own one preparation-inclusive deadline and client-attempt ceiling.
 Trusted transport classification never reads model claims.
 @param now - original monotonic clock
 @param signal - original cancellation
 @param isRetryableTransportFailure - fixed classification of actual transport errors
 @returns original judgment budget without renewal or reset operations
 @example
 ```ts
 const budget = createJudgmentBudget({
   now: () => performance.now(),
   signal: new AbortController().signal,
   isRetryableTransportFailure: () => false,
 });
 budget.checkpoint();
 ```
 */
export function createJudgmentBudget({
  now,
  signal,
  isRetryableTransportFailure
}: JudgmentBudgetInput): JudgmentBudget {
  if((typeof now)!=='function')throw new JudgmentBudgetError('Judgment requires an owned monotonic clock');
  /** Original first clock reading includes all preparation in the budget. */
  const startedAt=now();
  /** Fixed expiry never changes after creation. */
  const deadlineAt=startedAt+durationMs;
  if((!Number.isFinite(startedAt))||(!Number.isFinite(deadlineAt))
    ||(deadlineAt<=startedAt))throw new JudgmentBudgetError('Judgment clock cannot represent its deadline');
  if(((typeof signal?.aborted)!=='boolean')||((typeof isRetryableTransportFailure)!=='function'))throw new JudgmentBudgetError('Judgment requires cancellation and an owned transport classifier');
  /** One original lifetime owns every mutable accounting field. */
  const accounting: {
    lastAt: number;
    attempts: number;
    retryUsed: boolean;
    running: boolean;
    finished: boolean;
    checking: boolean;
    retired: boolean;
    retirement: unknown;
  }={
    lastAt:startedAt,
    attempts:0,
    retryUsed:false,
    running:false,
    finished:false,
    checking:false,
    retired:false,
    retirement:undefined
  };
    
    
    
    
    
    
    
  /** Attempts retain their original failure and completion order. */
  const records=new Map<number, JudgmentAttemptRecord>();
  /**
   Reject expired, cancelled or previously retired evidence.
   @returns remaining milliseconds in the original lifetime
   */
  function checkpoint(): number {
    if(accounting.retired)throw accounting.retirement;
    if(accounting.finished)throw new JudgmentBudgetError('Judgment evidence collection already finished');
    if(accounting.checking)throw new JudgmentBudgetError('Judgment clock checks cannot reenter');
    accounting.checking=true;
    /** Restore callback entry only when this clock check exits. */
    using checkScope={
      [Symbol.dispose](): void {
        accounting.checking=false;
      }
    };
    try {
      if(signal.aborted)throw new JudgmentCancelledError(
        'Judgment was cancelled',
        {cause:signal.reason}
      );
      /** Read the original clock only after cancellation and reentrancy checks. */
      const current=now();
      if((!Number.isFinite(current))||(current<accounting.lastAt))throw new JudgmentBudgetError('Judgment clock moved backwards or became non-finite');
      accounting.lastAt=current;
      if(current>=deadlineAt)throw new JudgmentDeadlineError('Judgment preparation and assessment deadline expired');
      if(signal.aborted)throw new JudgmentCancelledError(
        'Judgment was cancelled',
        {cause:signal.reason}
      );
      return deadlineAt-current;
    } catch(error) {
      accounting.retired=true;
      accounting.retirement=error;
      throw error;
    }

  }
  /**
   Check lifetime after a failed attempt without replacing its original error.
   @param error - original transport failure
   */
  function retainFailureAtCheckpoint(error: unknown): void {
    /** Avoid retaining the same terminal failure twice. */
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
  }: { readonly error: unknown; readonly classificationError: unknown }): never {
    /** Preserve errors in their original occurrence order. */
    const failures=[
      error,
      classificationError
    ];
    /** Only newly observed boundary failures extend this aggregate. */
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
    /** Pending transport excludes overlapping dispatch and closure. */
    using attemptScope={
      [Symbol.dispose](): void {
        accounting.running=false;
      }
    };
    {
      // At most one retry can occur across every dispatch through this boundary.
      for(let invocation=0;invocation<attemptLimit;invocation+=1){
        checkpoint();
        if(accounting.attempts>=attemptLimit)throw new JudgmentAttemptLimitError('Judgment exhausted its three client attempts');
        accounting.attempts+=1;
        /** Original judgment-wide invocation ordinal. */
        const attempt=accounting.attempts;
        /** This dispatch has already consumed a failed transport invocation. */
        const retry=invocation>0;
        records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'started'
          })
        );
        /** Only the successful transport path publishes a response field. */
        const response: { value?: Result }={};
        try {
          // oxlint-disable-next-line eslint/no-await-in-loop -- Original failure classification gates the next attempt; see doc/troubleshooting/pi-sdk-staging.md, "Sequential native judgment retries".
          response.value=await operation(Object.freeze({
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
          /** The next attempt depends on classification of this actual failure. */
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
  /**
   Copy retained evidence without invoking the clock or renewing its lifetime.
   @returns immutable current accounting snapshot
   */
  function diagnostics(): JudgmentBudgetSnapshot {
    return Object.freeze({
    startedAt,
    deadlineAt,
    attempts:accounting.attempts,
    retryUsed:accounting.retryUsed,
    running:accounting.running,
    finished:accounting.finished,
    retired:accounting.retired,
    records:Object.freeze([...records.values()])
    });
  }
  /**
   Close evidence only after pending work ends and lifetime remains valid.
   @returns immutable final accounting snapshot
   */
  function finish(): JudgmentBudgetSnapshot {
    if(accounting.running||accounting.checking)throw new JudgmentBudgetError('Judgment cannot finish during an attempt or clock callback');
    checkpoint();
    accounting.finished=true;
    return diagnostics();
  }
  return Object.freeze({
    checkpoint,
    dispatch,
    finish,
    diagnostics
  });
}
//endregion
