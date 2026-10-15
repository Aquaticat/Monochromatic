/**
 Original preparation-inclusive judgment lifetime and transport accounting.
 @module
 */
import type {
  JudgmentAccounting,
  JudgmentAttemptRecord,
  JudgmentBudget,
  JudgmentBudgetInput,
  JudgmentBudgetSnapshot
} from './types.ts';
import {createJudgmentDispatcher} from './dispatch.ts';
import {
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
/**
 Original preparation-inclusive duration in milliseconds.
 */
const durationMs = 15_000;

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
  /**
   Original first clock reading includes all preparation in the budget.
   */
  const startedAt=now();
  /**
   Fixed expiry never changes after creation.
   */
  const deadlineAt=startedAt+durationMs;
  if((!Number.isFinite(startedAt))||(!Number.isFinite(deadlineAt))
    ||(deadlineAt<=startedAt))throw new JudgmentBudgetError('Judgment clock cannot represent its deadline');
  if(((typeof signal?.aborted)!=='boolean')||((typeof isRetryableTransportFailure)!=='function'))throw new JudgmentBudgetError('Judgment requires cancellation and an owned transport classifier');
  /**
   One original lifetime owns every mutable accounting field.
   */
  const accounting: JudgmentAccounting={
    bundles:0,
    calls:0,
    lastAt:startedAt,
    attempts:0,
    retryUsed:false,
    running:false,
    finished:false,
    checking:false,
    retired:false,
    retirement:undefined
  };
    
    
    
    
    
    
    
  /**
   Attempts retain their original failure and completion order.
   */
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
    /**
     Restore callback entry only when this clock check exits.
     */
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
      /**
       Read the original clock only after cancellation and reentrancy checks.
       */
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
   One transport owner shares the original clock, cancellation and accounting.
   */
  const dispatch=createJudgmentDispatcher({
    checkpoint,
    isRetryableTransportFailure,
    accounting,
    records,
    deadlineAt,
    signal
  });
  /**
   Copy retained evidence without invoking the clock or renewing its lifetime.
   
   @returns immutable current accounting snapshot
   */
  function diagnostics(): JudgmentBudgetSnapshot {
    return Object.freeze({
    bundles:accounting.bundles,
    calls:accounting.calls,
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
