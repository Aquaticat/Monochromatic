import {
  ExecutionContextOwnershipError,
  NestedGroupSupportError
} from '../execution-context-carrier/wrapper.mjs';
import {NativeExecutionGuardError} from '../execution-context-carrier/execute.mjs';

/** Actual native caller owns the selected tool, prepared argument tuple and original enclosing judgment. */
export async function executeWithOwnedMember({
  judgment,
  member,
  tool,
  args
}){
  const [toolCallId,params,,onUpdate]=args;
  let signal;
  const toolName=tool.name??'<unavailable>';
  let context;
    let reserved=false;
    let token;
  try {
    if((typeof tool.createExecutionContext)!=='function')throw new ExecutionContextOwnershipError('Selected native tool lacks its required execution context factory');
    signal=judgment.preparedMemberFor(member)
      .signal;
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
    judgment.assertExecutionEntry(token);
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
