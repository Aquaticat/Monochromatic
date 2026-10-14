export class RuntimeOperationError extends Error {constructor(message,options){super(message,options);this.name=this.constructor.name;}}
/** Snapshot only owned plain result fields before any replacement is published. */
export function prepareRuntimeResult(value){
  if(value===null||typeof value!=='object'||![Object.prototype,null].includes(Object.getPrototypeOf(value)))throw new RuntimeOperationError('Runtime factory must return an owned plain result record');
  const fields={};
  for(const name of ['session','services','diagnostics','modelFallbackMessage']){
    const descriptor=Object.getOwnPropertyDescriptor(value,name);
    if(!descriptor){if(name==='modelFallbackMessage'){fields[name]=undefined;continue;}throw new RuntimeOperationError('Runtime factory result is missing '+name);}
    if(!Object.hasOwn(descriptor,'value'))throw new RuntimeOperationError('Runtime factory result '+name+' must not be an accessor');
    fields[name]=descriptor.value;
  }
  if(!Array.isArray(fields.diagnostics))throw new RuntimeOperationError('Runtime diagnostics must be an array');
  return Object.freeze(fields);
}

//region Coordinate the existing registry, never mint constructor ownership or human authority here.
export function createRuntimeOperationOwner({lifecycle,readManager,assertRuntimeResult,initial}){
  if(typeof readManager!=='function'||typeof assertRuntimeResult!=='function'||typeof lifecycle?.completeRetirement!=='function')throw new RuntimeOperationError('Qualified lifecycle and native runtime-result readers are required');
  const preparedInitial=prepareRuntimeResult(initial);
  assertRuntimeResult(preparedInitial);
  let current=Object.freeze({session:preparedInitial.session,manager:readManager(preparedInitial.session)});
  let lease=lifecycle.capture(current),pending,closed=false,unavailable=false;
  const disposed=new WeakSet();
  function currentLease(){lifecycle.assertActive(lease);return lease;}
  function preparing(){if(!pending||pending.state!=='preparing')throw new RuntimeOperationError('No runtime operation is preparing');return pending;}
  function beforeEffects(){
    const operation=preparing();
    if(operation.dirty)return;
    operation.dirty=true;
    // A cleanup operation may already have an irreversibly retired source root.
    if(operation.transition)lifecycle.markMutation(operation.transition);
  }
  function noteDisposed(session){
    const operation=preparing();
    if(session!==operation.source.session||!operation.dirty)throw new RuntimeOperationError('Disposal completion is not for this operation\'s retired source session');
    disposed.add(session);
  }
  /** Publisher is fixed SDK code: synchronous private-field assignments, no callbacks or getters. */
  function apply({result,publish}){
    const operation=preparing();
    if(!operation.transition||!operation.dirty||operation.terminal)throw new RuntimeOperationError('Replacement application requires a retired replacement transition');
    if(typeof publish!=='function')throw new RuntimeOperationError('Native runtime state publisher is unavailable');
    const prepared=prepareRuntimeResult(result);assertRuntimeResult(prepared);
    const pair=Object.freeze({session:prepared.session,manager:readManager(prepared.session)});
    const nextLease=lifecycle.commit({transition:operation.transition,...pair});
    // Registry publication is irreversible. Do not later run failed-transition cleanup on this token.
    operation.state='applied';
    try{publish(prepared);}catch(error){unavailable=true;pending=undefined;throw new RuntimeOperationError('Native runtime publication failed after lifecycle commit; construct another runtime',{cause:error});}
    current=pair;lease=nextLease;unavailable=false;pending=undefined;
  }
  function failPreparing({operation,error}){
    const failures=[error];
    if(operation.transition){
      if(operation.dirty||operation.cancellationAttempted){try{lifecycle.retireFailed(operation.transition);}catch(cleanupError){failures.push(cleanupError);}unavailable=true;}
      else {
        try{lifecycle.cancelUnchanged(operation.transition);}catch(proofError){failures.push(proofError);try{lifecycle.retireFailed(operation.transition);}catch(cleanupError){failures.push(cleanupError);}unavailable=true;}
      }
    }
    operation.state='failed';if(pending===operation)pending=undefined;
    if(failures.length>1)throw new AggregateError(failures,'Runtime operation and retirement/cancellation failures retained');throw error;
  }
  async function run({body,terminal=false}){
    if(pending)throw new RuntimeOperationError('Another runtime operation is still preparing; wait for it to apply before replacing the runtime');
    if(closed){if(terminal)return;throw new RuntimeOperationError('Runtime is closed; construct another runtime');}
    if(unavailable&&!terminal)throw new RuntimeOperationError('Runtime has no admitted active root; close it and construct another runtime');
    // A completed native disposal is a cleanup receipt, not merely a liveness flag.
    if(terminal&&unavailable&&disposed.has(current.session)){closed=true;return;}
    let transition;
    if(!unavailable)transition=lifecycle.begin(lease);
    const operation={transition,source:current,state:'preparing',dirty:unavailable,terminal};pending=operation;
    try{
      const result=await body();
      if(operation.state==='applied')return result;
      if(operation.state!=='preparing'||pending!==operation)throw new RuntimeOperationError('Runtime operation lost its preparation binding');
      if(terminal){
        if(!operation.dirty||!disposed.has(operation.source.session))throw new RuntimeOperationError('Terminal runtime disposal did not complete for its retired source session');
        if(transition)lifecycle.completeRetirement(transition);
        operation.state='closed';closed=true;unavailable=true;pending=undefined;return result;
      }
      if(result?.cancelled!==true)throw new RuntimeOperationError('Runtime replacement returned without cancellation or application');
      operation.cancellationAttempted=true;lifecycle.cancelUnchanged(transition);operation.state='cancelled';pending=undefined;return result;
    }catch(error){
      // Post-apply callback errors preserve both the applied root and any nested successor.
      if(operation.state==='applied')throw error;
      return failPreparing({operation,error});
    }
  }
  function diagnostics(){return Object.freeze({closed,unavailable,preparing:pending!==undefined});}
  return Object.freeze({run,beforeEffects,noteDisposed,apply,currentLease,diagnostics});
}
//endregion
