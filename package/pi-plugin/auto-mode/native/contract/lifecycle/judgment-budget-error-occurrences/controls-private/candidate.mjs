//region Cooperative accounting for one enclosing judgment, never a permission or execution lease.
export class JudgmentBudgetError extends Error {constructor(
  message,
  options
){super(
  message,
  options
);this.name=this.constructor
  .name;}}
export class JudgmentDeadlineError extends JudgmentBudgetError {}
export class JudgmentCancelledError extends JudgmentBudgetError {}
export class JudgmentAttemptLimitError extends JudgmentBudgetError {}

/** Own one preparation-inclusive deadline and client-attempt ceiling; trusted transport classifier never reads model claims. */
export function createJudgmentBudget({
  now,
  signal,
  isRetryableTransportFailure
}) {
  if((typeof now)!=='function')throw new JudgmentBudgetError('Judgment requires an owned monotonic clock');
  const startedAt=now();
  const deadlineAt=startedAt+5_000;
  if((!Number.isFinite(startedAt))||(!Number.isFinite(deadlineAt))
    ||(deadlineAt<=startedAt))throw new JudgmentBudgetError('Judgment clock cannot represent its deadline');
  if(((typeof signal?.aborted)!=='boolean')||((typeof isRetryableTransportFailure)!=='function'))throw new JudgmentBudgetError('Judgment requires cancellation and an owned transport classifier');
  let lastAt=startedAt;
    let attempts=0;
    let retryUsed=false;
    let running=false;
    let finished=false;
    let checking=false;
    let retired=false;
    let retirement;
  const records=new Map();
  function checkpoint() {
    if(retired)throw retirement;
    if(finished)throw new JudgmentBudgetError('Judgment evidence collection already finished');
    if(checking)throw new JudgmentBudgetError('Judgment clock checks cannot reenter');
    checking=true;
    try {
      if(signal.aborted)throw new JudgmentCancelledError(
        'Judgment was cancelled',
        {cause:signal.reason}
      );
      const current=now();
      if((!Number.isFinite(current))||(current<lastAt))throw new JudgmentBudgetError('Judgment clock moved backwards or became non-finite');
      lastAt=current;
      if(current>=deadlineAt)throw new JudgmentDeadlineError('Judgment preparation and assessment deadline expired');
      if(signal.aborted)throw new JudgmentCancelledError(
        'Judgment was cancelled',
        {cause:signal.reason}
      );
      return deadlineAt-current;
    } catch(error) {retired=true;retirement=error;throw error;}
    finally {checking=false;}
  }
  function retainFailureAtCheckpoint(error) {
    const alreadyRetired=retired;
    try {checkpoint();}
    catch(terminal) {if(alreadyRetired&&(terminal===error))throw error;throw new AggregateError(
      [
        error,
        terminal
      ],
      'Transport failure and judgment boundary failure',
      { cause: terminal }
    );}
  }
  function throwClassificationFailure({
    error,
    classificationError
  }) {
    const failures=[
      error,
      classificationError
    ]; const alreadyRetired=retired;
    try {checkpoint();}
    catch(terminal){if((!alreadyRetired)||(!failures.includes(terminal)))failures.push(terminal);}
    throw new AggregateError(
      failures,
      'Transport failure and classifier failure'
    );
  }
  async function dispatch(operation) {
    if(running||checking)throw new JudgmentBudgetError('Judgment attempts cannot overlap or reenter');
    if((typeof operation)!=='function')throw new JudgmentBudgetError('Judgment transport operation must be an owned function');
    checkpoint();
    running=true;
    try {
      // At most one retry can occur across every dispatch through this boundary.
      for(let invocation=0;invocation<3;invocation+=1){
        checkpoint();
        if(attempts>=3)throw new JudgmentAttemptLimitError('Judgment exhausted its three client attempts');
        attempts+=1;
        const attempt=attempts;
        const retry=invocation>0;
        records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'started'
          })
        );
        let value;
        try {value=await operation(Object.freeze({
          signal,
          deadlineAt,
          attempt
        }));}
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
          if(retryUsed||(attempts>=3))throw error;
          let retryable;
          try {retryable=isRetryableTransportFailure(error);}
          catch(classificationError){throwClassificationFailure({
            error,
            classificationError
          });}
          if((typeof retryable)!=='boolean')throwClassificationFailure({
            error,
            classificationError:new JudgmentBudgetError('Transport classifier must return a synchronous Boolean')
          });
          retainFailureAtCheckpoint(error);
          if(!retryable)throw error;
          retryUsed=true;
          continue;
        }
        try {checkpoint();}
        catch(error){records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'discarded',
            error
          })
        );throw error;}
        records.set(
          attempt,
          Object.freeze({
            attempt,
            retry,
            state:'succeeded'
          })
        );
        return value;
      }
      throw new JudgmentBudgetError('Judgment retry loop ended without an outcome');
    } finally {running=false;}
  }
  function diagnostics(){return Object.freeze({
    startedAt,
    deadlineAt,
    attempts,
    retryUsed,
    running,
    finished,
    retired,
    records:Object.freeze([...records.values()])
  });}
  function finish(){if(running||checking)throw new JudgmentBudgetError('Judgment cannot finish during an attempt or clock callback');checkpoint();finished=true;return diagnostics();}
  return Object.freeze({
    checkpoint,
    dispatch,
    finish,
    diagnostics
  });
}
//endregion
