import {RootLeaseError,RootLeaseOwnershipError,RootLeaseSuspendedError,RootLeaseRetiredError,RootTransitionError} from './lifecycle-errors.mjs';
//region Diagnostics retain failure evidence without replacing lifecycle outcomes.
export function createLifecycleDiagnostics(trace){
    const traceFailures=[];
  const state={busy:false,suppressedTraceEvents:0,traceDisabled:false};
  // Diagnostics cannot hide a returned handle or change an operation's completion outcome.
  function emit(event){
    if(state.traceDisabled){state.suppressedTraceEvents+=1;return;}
    try{trace(event);}catch(error){traceFailures.push(error);if(traceFailures.length===64)state.traceDisabled=true;}
  }
  function diagnostics(){return Object.freeze({
    traceFailures:Object.freeze([...traceFailures]),
    traceDisabled:state.traceDisabled,
    suppressedTraceEvents:state.suppressedTraceEvents
  });}
  function exclusive(operation){
    if(state.busy)throw new RootTransitionError('Lifecycle operations cannot reenter through callbacks');
    state.busy=true;
    using operationScope={
      [Symbol.dispose]() {
        state.busy=false;
      }
    };
    return operation();
  }
 return {emit,diagnostics,exclusive};
}
//endregion
