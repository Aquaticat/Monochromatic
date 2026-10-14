import {
  prepareRuntimeResult,
  RuntimeOperationError
} from '../runtime-initial-admission-v2/operations.mjs';

//region Track factory flow and cleanup obligations, not another manager/session identity registry.
export function createRuntimeFactoryScopes({
  lifecycle,
  readManager,
  assertRuntimeResult,
  disposeSession,
  prepareResult=prepareRuntimeResult
}){
  if(((typeof lifecycle?.beginConstruction)!=='function')||((typeof lifecycle?.abandonConstruction)!=='function')
    ||((typeof readManager)!=='function')
    ||((typeof assertRuntimeResult)!=='function')
    ||((typeof disposeSession)!=='function')
    ||((typeof prepareResult)!=='function'))throw new RuntimeOperationError('Construction lifecycle, native readers and native disposal are required');
  const pendingCleanup=new Set();let busy=false;
  function exclusive(body){if(busy)throw new RuntimeOperationError('Factory scope operations cannot reenter through callbacks');busy=true;try{return body();}finally{busy=false;}}
  function begin({
    manager,
    transition
  }){
    if(pendingCleanup.size > 0)throw new RuntimeOperationError('Failed construction cleanup is pending; retry cleanup before constructing another runtime');
    const token=lifecycle.beginConstruction({
      manager,
      transition
    });let disposed=false;
      let phase='open';
      let prepared;
      let registered;
    function open(){if(phase!=='open')throw new RuntimeOperationError('Factory scope is no longer preparing');}
    function registerSession(session){
      open();if(registered)throw new RuntimeOperationError('Factory scope already registered its session');
      lifecycle.bindConstruction({
        construction:token,
        session
      });registered=session;
    }
    function accept(result){
      open();if(prepared)throw new RuntimeOperationError('Factory scope result was already accepted');
      const value=prepareResult(result);
      if((!registered)||(value.session!==registered))throw new RuntimeOperationError('Factory result is not the exact session registered by this construction');
      if(readManager(value.session)!==manager)throw new RuntimeOperationError('Factory result session has another manager');
      assertRuntimeResult(value);prepared=value;return value;
    }
    function publish(result){
      open();if((!prepared)||(result!==prepared))throw new RuntimeOperationError('Publication requires this factory scope\'s exact prepared result');
      assertRuntimeResult(prepared);
      if(readManager(prepared.session)!==manager)throw new RuntimeOperationError('Prepared factory session changed its manager');
      const lease=lifecycle.publishConstruction(token);phase='published';return lease;
    }
    function cleanup(){
      const obligation=lifecycle.abandonConstruction(token);
      // Early native liveness retirement is not evidence that cleanup returned successfully.
      if(obligation.session&&(!disposed)){disposeSession(obligation.session);disposed=true;}
      pendingCleanup.delete(cleanup);
    }
    function abort(){
      if(phase==='published')throw new RuntimeOperationError('Applied factory scope cannot be abandoned');
      phase='abandoned';pendingCleanup.add(cleanup);cleanup();
    }
    return Object.freeze({
      registerSession:function registerExclusiveSession(session) { return (exclusive(function registerConstructedSession() { registerSession(session); })); },
      accept:function acceptExclusiveResult(result) { return (exclusive(function acceptConstructedResult() { return (accept(result)); })); },
      publish:function publishExclusiveResult(result) { return (exclusive(function publishConstructedResult() { return (publish(result)); })); },
      abort:function abortExclusiveConstruction() { return (exclusive(abort)); }
    });
  }
  function retryCleanup(){
    const failures=[];
    for(const cleanup of [...pendingCleanup])try{cleanup();}catch(error){failures.push(error);}
    if(failures.length > 0)throw new AggregateError(
      failures,
      'Failed construction cleanup remains pending'
    );
  }
  return Object.freeze({
    begin:function beginExclusiveFactoryScope(input) { return (exclusive(function beginFactoryOccurrence() { return (begin(input)); })); },
    retryCleanup:function retryExclusiveCleanup() { return (exclusive(retryCleanup)); },
    diagnostics:function inspectPendingCleanup() { return (Object.freeze({pendingCleanup:pendingCleanup.size})); }
  });
}
//endregion
