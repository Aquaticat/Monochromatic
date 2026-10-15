import {
  ExecutionContextOwnershipError,
  NestedGroupSupportError
} from './wrapper.mjs';

/** A guard/retirement failure is distinct from an ordinary native tool failure; all caught occurrences remain retained. */
export class NativeExecutionGuardError extends AggregateError {
  constructor({
    errors,
    phase,
    toolCallId,
    toolName
  }){
    const affected=`Tool ${JSON.stringify(toolName)} call ${JSON.stringify(toolCallId)}`;
    const detail=phase==='entry'?'could not establish its original execution context before starting. Resolve the recorded ownership, source, or required-factory failure before retrying the complete group.':phase==='return'?'could not complete execution-occurrence cleanup. The effect may already have completed or failed; inspect the retained original and cleanup failures, and do not repeat the effect merely to retry cleanup.':'failed execution-context validation or lacks complete nested-group support. Completed effects may remain; inspect the retained failure and do not replace the original judgment with a new budget.';
    super(
      errors,
      `${affected} ${detail}`
    );this.name=this.constructor
      .name;this.phase=phase;
  }
}

/** Actual native caller owns the selected tool, prepared argument tuple and original enclosing judgment. */
export async function executeWithOwnedContext({
  judgment,
  tool,
  args
}){
  const [toolCallId,params,signal,onUpdate]=args;
  const toolName=tool.name??'<unavailable>';
  let context;
    let reserved=false;
    let token;
  try {
    if((typeof tool.createExecutionContext)!=='function')throw new ExecutionContextOwnershipError('Selected native tool lacks its required execution context factory');
    const member=judgment.memberFor(toolCallId);
    token=judgment.beginExecution(member);reserved=true;
    const origin=judgment.executionFor(token);
    const carrier=Object.freeze({
      response:origin.response,
      stream:origin.stream,
      token
    });
    context=tool.createExecutionContext({
      carrier,
      toolCallId,
      params,
      signal,
      onUpdate
    });
  }catch(error){
    const errors=[error];
    if(reserved)try{judgment.finishExecution(token);}catch(cleanupError){errors.push(cleanupError);}
    throw new NativeExecutionGuardError({
      errors,
      phase:'entry',
      toolCallId,
      toolName
    });
  }
  let failed=false;
    let failure;
    let value;
  try {value=await tool.execute(
    toolCallId,
    params,
    signal,
    onUpdate,
    context
  );}
  catch(error){failed=true;failure=error;}
  try {judgment.finishExecution(token);}
  catch(cleanupError){throw new NativeExecutionGuardError({
    errors:failed?[
      failure,
      cleanupError
    ]:[cleanupError],
    phase:'return',
    toolCallId,
    toolName
  });}
  if(failed){
    if((failure instanceof ExecutionContextOwnershipError)||(failure instanceof NestedGroupSupportError))throw new NativeExecutionGuardError({
      errors:[failure],
      phase:'validation',
      toolCallId,
      toolName
    });
    throw failure;
  }
  return value;
}
