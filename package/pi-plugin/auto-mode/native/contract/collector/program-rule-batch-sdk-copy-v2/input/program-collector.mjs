import {createGroupDispatch} from './group-dispatch.ts';
import {createGroupCurrent} from './group-current.ts';
import {createGroupFailures} from './program-collector-failures.mjs';
import {createGroupCompletions} from './program-collector-completions.mjs';

import {DeclaredGroupCollectionError} from './group-collection-error.ts';
import {createGroupLifetime} from './group-lifetime.ts';
export {DeclaredGroupCollectionError} from './group-collection-error.ts';

//region Run-local collection and transport lifetime, separate from actual native execution lifetime.
/**
 Collect exact source members without creating judgment, inference or permission.
 dispatchGroup returns ordered completion promises after owning complete preparation/admission.
 Transport closure cancels delivery; eventual completions remain inspectable and drainable.
 */
export function createReachedGroupRun({
  group,
  readGroup,
  signal,
  assertParentCurrent,
  dispatchGroup
}){
  if((!(signal instanceof AbortSignal))||((typeof assertParentCurrent)!=='function')
    ||((typeof dispatchGroup)!=='function')
    ||((typeof readGroup)!=='function'))throw new DeclaredGroupCollectionError('Original parent cancellation and group consumer are required');
  const view=readGroup(group);
  if((!Object.isFrozen(view))||(view.handle!==group)
    ||(!Object.isFrozen(view.members)))throw new DeclaredGroupCollectionError('Canonical reached group view is required');
  const declaration=Object.freeze({
    source:view.declaration
      .source,
    members:view.members
  });
    const handle=group;
    const controller=new AbortController();
  const records=declaration.members
    .map(function createMemberRecord(member) { return (({
      member,
      handle:Object.freeze({}),
      arrival:'unarrived',
      state:'unarrived',
      ticket:undefined,
      signal:undefined,
      removeAbort:undefined,
      completion:undefined
    })); });
  const failures=[];
    
  const groupState={checking:false,closed:false,dispatches:0,phase:'collecting',phaseAtReturn:undefined,primary:undefined,unboundPending:0,work:Promise.resolve(),unboundOutcomes:Object.freeze([])};
  const {recordFailure,abortOccurrence,retainBoundaryFailure}=createGroupFailures({groupState,failures,controller,rejectPending});
  const {checkAbort,current,onParentAbort}=createGroupCurrent({group,view,readGroup,signal,assertParentCurrent,groupState,records,recordFailure,abortOccurrence});
  const {detach,observeCompletion}=createGroupCompletions({groupState,records,signal,onParentAbort});
    
    
    
    
    
    
    
    

  function rejectPending({
    error,
    state
  }){
    for(const record of records)if(record.state==='pending'){record.state=state;record.ticket
      .reject(error);}
  }
  
  
  const {startDispatch}=createGroupDispatch({handle,declaration,records,groupState,current,dispatchGroup,recordFailure,retainBoundaryFailure,observeCompletion});
  async function invoke({
    record,
    args,
    nativeSignal
  }){
    const invocation={ticket:undefined};
    try{
      if(groupState.checking)throw new DeclaredGroupCollectionError('Declared group collection cannot reenter through callbacks');
      groupState.checking=true;
      {
        using collection={ [Symbol.dispose]() {groupState.checking=false;} };

        current();
        if((groupState.phase!=='collecting')||(record.arrival!=='unarrived'))throw new DeclaredGroupCollectionError('Declared member callback cannot be replayed');
        if(!(nativeSignal instanceof AbortSignal))throw new DeclaredGroupCollectionError('Native member cancellation is required');
        if(JSON.stringify(args)
          !==record.member
          .argsJSON)throw new DeclaredGroupCollectionError('Native member arguments differ from the declared callsite');
        checkAbort({
          observed:nativeSignal,
          at:'native-cancellation'
        });current();
        invocation.ticket=Promise.withResolvers();record.ticket=invocation.ticket;record.arrival='matched';record.state='pending';
        record.signal=AbortSignal.any([
          signal,
          nativeSignal,
          controller.signal
        ]);
        function onNativeAbort() {
          if(groupState.closed||(groupState.phase==='settled')
            ||(record.completion!==undefined))return;
          abortOccurrence({
            observed:nativeSignal,
            at:'native-cancellation'
          });
        }
        nativeSignal.addEventListener(
          'abort',
          onNativeAbort,
          {once:true}
        );record.removeAbort=function removeNativeAbort() { nativeSignal.removeEventListener(
          'abort',
          onNativeAbort
        ); };
        // Abort events do not replay when a constituent was aborted by the final parent-reader callback.
        if(nativeSignal.aborted)onNativeAbort();
        if(signal.aborted)onParentAbort();
      
      }
      if((!groupState.primary)&&(!groupState.closed)
        &&records.every(function hasArrivedMember(value) { return (value.arrival==='matched'); }))startDispatch();
    }catch(error){
      const recorded=retainBoundaryFailure({
        error,
        at:'member-entry'
      });
      if(!invocation.ticket)throw recorded.occurrence
        .error;
      rejectPending({
        error:recorded.occurrence
          .error,
        state:'rejected'
      });
    }
    return await invocation.ticket.promise;
  }
  signal.addEventListener(
    'abort',
    onParentAbort,
    {once:true}
  );
  if(signal.aborted)onParentAbort();
  const tools=Object.freeze(records.map(function createGroupTool(record) { return (Object.freeze({
    name:record.member
      .alias,
    execute(
      args,
      context
    ){return invoke({
      record,
      args,
      nativeSignal:context.signal
    });}
  })); }));
  const {retire,drain,inspect}=createGroupLifetime({groupState,records,failures,controller,detach,recordFailure,rejectPending});
  return Object.freeze({
    declaration,
    tools,
    retire,
    drain,
    inspect
  });
}
//endregion
