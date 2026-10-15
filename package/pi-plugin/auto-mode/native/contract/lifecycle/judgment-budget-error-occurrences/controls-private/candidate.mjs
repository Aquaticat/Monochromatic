import {
  JudgmentAttemptLimitError,
  JudgmentBudgetError,
  JudgmentCancelledError,
  JudgmentDeadlineError
} from './errors.mjs';

export {
  JudgmentAttemptLimitError,
  JudgmentBudgetError,
  JudgmentCancelledError,
  JudgmentDeadlineError
} from './errors.mjs';

//region Cooperative accounting for one enclosing judgment, never a permission or execution lease.
/** Original preparation-inclusive duration in milliseconds. */
const durationMs = 5_000;
/** Shared client-attempt allowance across all dispatches in one judgment. */
const attemptLimit = 3;

/**
 Own one preparation-inclusive deadline and client-attempt ceiling.
 Trusted transport classification never reads model claims.
 @param {{now: () => number, signal: AbortSignal, isRetryableTransportFailure: (error: unknown) => boolean}} input - original clock, cancellation and transport classification
 */
export function createJudgmentBudget({
  now,
  signal,
  isRetryableTransportFailure
}) {
  if((typeof now)!=='function')throw new JudgmentBudgetError('Judgment requires an owned monotonic clock');
  const startedAt=now();
  const deadlineAt=startedAt+durationMs;
  if((!Number.isFinite(startedAt))||(!Number.isFinite(deadlineAt))
    ||(deadlineAt<=startedAt))throw new JudgmentBudgetError('Judgment clock cannot represent its deadline');
  if(((typeof signal?.aborted)!=='boolean')||((typeof isRetryableTransportFailure)!=='function'))throw new JudgmentBudgetError('Judgment requires cancellation and an owned transport classifier');
  /** @type {{lastAt: number, attempts: number, retryUsed: boolean, running: boolean, finished: boolean, checking: boolean, retired: boolean, retirement: unknown}} */
  const accounting={
    lastAt:startedAt,
    attempts:0,
    retryUsed:false,
    running:false,
    finished:false,
    checking:false,
    retired:false,
    retirement:undefined
  };
    
    
    
    
    
    
    
  /** @type {Map<number, Readonly<{attempt: number, retry: boolean, state: 'started' | 'failed' | 'discarded' | 'succeeded', error?: unknown}>>} */
  const records=new Map();
  function checkpoint() {
    if(accounting.retired)throw accounting.retirement;
    if(accounting.finished)throw new JudgmentBudgetError('Judgment evidence collection already finished');
    if(accounting.checking)throw new JudgmentBudgetError('Judgment clock checks cannot reenter');
    accounting.checking=true;
    using checkScope={
      [Symbol.dispose]() {
        accounting.checking=false;
      }
    };
    try {
      if(signal.aborted)throw new JudgmentCancelledError(
        'Judgment was cancelled',
        {cause:signal.reason}
      );
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
   @param {unknown} error - original transport failure
   */
  function retainFailureAtCheckpoint(error) {
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
   @param {{error: unknown, classificationError: unknown}} input - failed attempt and classification
   @returns {never} no successful classification
   */
  function throwClassificationFailure({
    error,
    classificationError
  }) {
    const failures=[
      error,
      classificationError
    ];
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
   @param {unknown} error - original failed attempt
   @returns {boolean} fixed transport classifier decision
   */
  function classifyRetry(error) {
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
   @template Result
   @param {(input: Readonly<{signal: AbortSignal, deadlineAt: number, attempt: number}>) => Promise<Result>} operation - original transport attempt
   @returns {Promise<Result>} response belonging to the completed attempt
   */
  async function dispatch(operation) {
    if(accounting.running||accounting.checking)throw new JudgmentBudgetError('Judgment attempts cannot overlap or reenter');
    if((typeof operation)!=='function')throw new JudgmentBudgetError('Judgment transport operation must be an owned function');
    checkpoint();
    accounting.running=true;
    using attemptScope={
      [Symbol.dispose]() {
        accounting.running=false;
      }
    };
    {
      // At most one retry can occur across every dispatch through this boundary.
      for(let invocation=0;invocation<attemptLimit;invocation+=1){
        checkpoint();
        if(accounting.attempts>=attemptLimit)throw new JudgmentAttemptLimitError('Judgment exhausted its three client attempts');
        accounting.attempts+=1;
        const attempt=accounting.attempts;
        const retry=invocation>0;
        records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'started'
          })
        );
        /** @type {{value: Result | undefined}} */
        const response={value:undefined};
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
  function diagnostics(){
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
  function finish(){
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
