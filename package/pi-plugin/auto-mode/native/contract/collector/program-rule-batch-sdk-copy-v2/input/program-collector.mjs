import {createGroupFailures} from './program-collector-failures.mjs';
import {createGroupCompletions} from './program-collector-completions.mjs';

export class DeclaredGroupCollectionError extends Error {
  constructor(message){super(message);this.name=this.constructor
    .name;}
}



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
    
  const groupState={checking:false,closed:false,dispatches:0,phase:'collecting',phaseAtReturn:undefined,primary:undefined,unboundPending:0,work:undefined,unboundOutcomes:Object.freeze([])};
  const {recordFailure,abortOccurrence,retainBoundaryFailure}=createGroupFailures({groupState,failures,controller,rejectPending});
  const {detach,observeCompletion}=createGroupCompletions({groupState,records,signal,onParentAbort});
    
    
    
    
    
    
    
    

  function rejectPending({
    error,
    state
  }){
    for(const record of records)if(record.state==='pending'){record.state=state;record.ticket
      .reject(error);}
  }
  
  
  function checkAbort({
    observed,
    at
  }){if(observed.aborted)throw abortOccurrence({
    observed,
    at
  });}
  function current(){
    if(groupState.primary)throw groupState.primary;
    if(groupState.closed)throw new DeclaredGroupCollectionError('Declared parent group has returned');
    checkAbort({
      observed:signal,
      at:'original-cancellation'
    });
    // Only a newly thrown callback value creates an occurrence here, even if equal to an existing value.
    try{assertParentCurrent();if(readGroup(group)!==view)throw new DeclaredGroupCollectionError('Reached group view changed during native collection');}catch(error){throw recordFailure({
      error,
      at:'parent-current-reader'
    });}
    checkAbort({
      observed:signal,
      at:'original-cancellation'
    });
    if(groupState.primary)throw groupState.primary;
    if(groupState.closed)throw new DeclaredGroupCollectionError('Declared parent group has returned');
  }
  function onParentAbort(){
    if(groupState.closed||(groupState.phase==='settled')
      ||records.every(function hasCompletion(record) { return (record.completion!==undefined); }))return;
    abortOccurrence({
      observed:signal,
      at:'original-cancellation'
    });
  }
  
  
  
  
  async function dispatch(){
    try{
      current();
      if(!records.every(function hasArrived(record) { return (record.arrival==='matched'); }))throw new DeclaredGroupCollectionError('Declared member set is incomplete');
      groupState.phase='dispatching';groupState.dispatches++;
      const members=Object.freeze(records.map(function createDispatchMember(record) { return (Object.freeze({
        handle:record.handle,
        declaration:record.member,
        signal:record.signal
      })); }));
      let completions;
      try{completions=await dispatchGroup(Object.freeze({
        handle,
        declaration,
        members
      }));}
      catch(error){throw recordFailure({
        error,
        at:'group-consumer'
      });}
      if((!Array.isArray(completions))||(completions.length!==records.length)
        ||records.some(function isMissingCompletion(record,
        index) { return (!Object.hasOwn(
        completions,
        index
      )); })){
        const failure=recordFailure({
          error:new DeclaredGroupCollectionError('Complete group consumer returned a different member set'),
          at:'group-dispatch'
        });
        if(Array.isArray(completions)){
          // These outcomes have no admitted member association. Enumeration skips holes, not returned promises.
          const entries=Object.entries(completions);groupState.unboundPending=entries.length;
          const settled=await Promise.allSettled(entries.map(function readUnboundCompletion([,completion]) { return (completion); }));
          groupState.unboundOutcomes=Object.freeze(settled.map(function retainUnboundOutcome(outcome,
            index) { return (Object.freeze({
            retainedOnly:true,
            sourceKey:entries[index][0],
            ...outcome
          })); }));groupState.unboundPending=0;
        }
        throw failure;
      }
      const settlements=records.map(function observeMemberCompletion(record,
        index) { return (observeCompletion({
        record,
        completion:completions[index]
      })); });
      // Returned parents cannot receive more transport results. Observe already-issued completions regardless.
      if(!groupState.closed){try{current();}catch(error){retainBoundaryFailure({
        error,
        at:'group-consumer-tail'
      });}}
      await Promise.allSettled(settlements);
    }catch(error){retainBoundaryFailure({
      error,
      at:'group-dispatch'
    });}
  }
  function startDispatch(){
    const completion=Promise.withResolvers();groupState.work=completion.promise;
    // Publish work before any synchronous parent-reader or consumer callback can request its drain.
    async function run(){
      using lifetime1={ [Symbol.dispose]() {completion.resolve();} };
    try{await dispatch();}catch(error){retainBoundaryFailure({
        error,
        at:'dispatcher-completion'
      });}
    }
    void run();
  }
  async function invoke({
    record,
    args,
    nativeSignal
  }){
    let ticket;
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
        ticket=Promise.withResolvers();record.ticket=ticket;record.arrival='matched';record.state='pending';
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
      if(!ticket)throw recorded.occurrence
        .error;
      rejectPending({
        error:recorded.occurrence
          .error,
        state:'rejected'
      });
    }
    return await ticket.promise;
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
  function retire(){
    if(groupState.closed)return;
    detach();groupState.phaseAtReturn=groupState.phase;
    if((groupState.phase==='collecting')&&(!groupState.primary))recordFailure({
      error:new DeclaredGroupCollectionError('Parent returned before declared membership completed'),
      at:'incomplete-membership-return'
    });
    groupState.closed=true;
    const reason=new DeclaredGroupCollectionError('Declared parent group has returned');
    rejectPending({
      error:reason,
      state:'cancelled'
    });controller.abort(reason);
  }
  async function drain(){await groupState.work;}
  function inspect(){return Object.freeze({
    phase:groupState.closed?'closed':groupState.phase,
    phaseAtReturn:groupState.phaseAtReturn,
    failed:groupState.primary!==undefined,
    failure:groupState.primary?.occurrence
      .error,
    failures:Object.freeze([...failures]),
    dispatches:groupState.dispatches,
    unboundPending:groupState.unboundPending,
    unboundOutcomes:groupState.unboundOutcomes,
    members:Object.freeze(records.map(function inspectMember(record) { return (Object.freeze({
      ordinal:record.member
        .ordinal,
      arrival:record.arrival,
      state:record.state,
      completion:record.completion
    })); })),
    executionState:'owned-by-native-consumer-not-inferred',
    effectQualification:'not-established'
  });}
  return Object.freeze({
    declaration,
    tools,
    retire,
    drain,
    inspect
  });
}
//endregion
