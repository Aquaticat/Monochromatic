
export class DeclaredGroupCollectionError extends Error {
  constructor(message){super(message);this.name=this.constructor
    .name;}
}

/** Internal control-flow token distinguishes recorded delivery from a new equal-valued failure. */
class RecordedFailure extends Error {
  constructor(occurrence){super('Declared group failure already recorded');this.occurrence=occurrence;}
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
    .map(member=>({
      member,
      handle:Object.freeze({}),
      arrival:'unarrived',
      state:'unarrived',
      ticket:undefined,
      signal:undefined,
      removeAbort:undefined,
      completion:undefined
    }));
  const failures=[];
    const abortOccurrences=new WeakMap();
  let checking=false;
    let closed=false;
    let dispatches=0;
    let phase='collecting';
    let phaseAtReturn;
    let primary;
    let unboundPending=0;
    let work;
    let unboundOutcomes=Object.freeze([]);

  function rejectPending({
    error,
    state
  }){
    for(const record of records)if(record.state==='pending'){record.state=state;record.ticket
      .reject(error);}
  }
  function recordFailure({
    error,
    at
  }){
    const occurrence=Object.freeze({
      identity:Object.freeze({}),
      ordinal:failures.length,
      at,
      error
    });
    const recorded=new RecordedFailure(occurrence);failures.push(occurrence);
    if((!primary)&&(!closed)
      &&(phase!=='settled')){
      primary=recorded;phase='failed';rejectPending({
        error,
        state:'rejected'
      });controller.abort(error);
    }
    return recorded;
  }
  function abortOccurrence({
    observed,
    at
  }){
    let recorded=abortOccurrences.get(observed);
    if(!recorded){recorded=recordFailure({
      error:observed.reason,
      at
    });abortOccurrences.set(
      observed,
      recorded
    );}
    return recorded;
  }
  function checkAbort({
    observed,
    at
  }){if(observed.aborted)throw abortOccurrence({
    observed,
    at
  });}
  function current(){
    if(primary)throw primary;
    if(closed)throw new DeclaredGroupCollectionError('Declared parent group has returned');
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
    if(primary)throw primary;
    if(closed)throw new DeclaredGroupCollectionError('Declared parent group has returned');
  }
  function onParentAbort(){
    if(closed||(phase==='settled')
      ||records.every(record=>record.completion!==undefined))return;
    abortOccurrence({
      observed:signal,
      at:'original-cancellation'
    });
  }
  function detach(){
    signal.removeEventListener(
      'abort',
      onParentAbort
    );
    for(const record of records){record.removeAbort?.();record.removeAbort=undefined;}
  }
  function completed(){
    if(records.every(record=>record.completion!==undefined)){
      detach();if((!primary)&&(!closed))phase='settled';
    }
  }
  async function observeCompletion({
    record,
    completion
  }){
    try{
      const value=await completion;record.completion=Object.freeze({
        status:'fulfilled',
        value
      });
      if(record.state==='pending'){record.state='fulfilled';record.ticket
        .resolve(value);}
    }catch(error){
      record.completion=Object.freeze({
        status:'rejected',
        reason:error
      });
      if(record.state==='pending'){record.state='rejected';record.ticket
        .reject(error);}
    }finally{record.removeAbort?.();record.removeAbort=undefined;completed();}
  }
  function retainBoundaryFailure({
    error,
    at
  }){return error instanceof RecordedFailure?error:recordFailure({
    error,
    at
  });}
  async function dispatch(){
    try{
      current();
      if(!records.every(record=>record.arrival==='matched'))throw new DeclaredGroupCollectionError('Declared member set is incomplete');
      phase='dispatching';dispatches++;
      const members=Object.freeze(records.map(record=>Object.freeze({
        handle:record.handle,
        declaration:record.member,
        signal:record.signal
      })));
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
        ||records.some((
        record,
        index
      )=>!Object.hasOwn(
        completions,
        index
      ))){
        const failure=recordFailure({
          error:new DeclaredGroupCollectionError('Complete group consumer returned a different member set'),
          at:'group-dispatch'
        });
        if(Array.isArray(completions)){
          // These outcomes have no admitted member association. Enumeration skips holes, not returned promises.
          const entries=Object.entries(completions);unboundPending=entries.length;
          const settled=await Promise.allSettled(entries.map(([,completion])=>completion));
          unboundOutcomes=Object.freeze(settled.map((
            outcome,
            index
          )=>Object.freeze({
            retainedOnly:true,
            sourceKey:entries[index][0],
            ...outcome
          })));unboundPending=0;
        }
        throw failure;
      }
      const settlements=records.map((
        record,
        index
      )=>observeCompletion({
        record,
        completion:completions[index]
      }));
      // Returned parents cannot receive more transport results. Observe already-issued completions regardless.
      if(!closed){try{current();}catch(error){retainBoundaryFailure({
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
    const completion=Promise.withResolvers();work=completion.promise;
    // Publish work before any synchronous parent-reader or consumer callback can request its drain.
    async function run(){
      try{await dispatch();}catch(error){retainBoundaryFailure({
        error,
        at:'dispatcher-completion'
      });}
      finally{completion.resolve();}
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
      if(checking)throw new DeclaredGroupCollectionError('Declared group collection cannot reenter through callbacks');
      checking=true;
      try{
        current();
        if((phase!=='collecting')||(record.arrival!=='unarrived'))throw new DeclaredGroupCollectionError('Declared member callback cannot be replayed');
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
          if(closed||(phase==='settled')
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
        );record.removeAbort=()=>{ nativeSignal.removeEventListener(
          'abort',
          onNativeAbort
        ); };
        // Abort events do not replay when a constituent was aborted by the final parent-reader callback.
        if(nativeSignal.aborted)onNativeAbort();
        if(signal.aborted)onParentAbort();
      }finally{checking=false;}
      if((!primary)&&(!closed)
        &&records.every(value=>value.arrival==='matched'))startDispatch();
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
  const tools=Object.freeze(records.map(record=>Object.freeze({
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
  })));
  function retire(){
    if(closed)return;
    detach();phaseAtReturn=phase;
    if((phase==='collecting')&&(!primary))recordFailure({
      error:new DeclaredGroupCollectionError('Parent returned before declared membership completed'),
      at:'incomplete-membership-return'
    });
    closed=true;
    const reason=new DeclaredGroupCollectionError('Declared parent group has returned');
    rejectPending({
      error:reason,
      state:'cancelled'
    });controller.abort(reason);
  }
  async function drain(){await work;}
  function inspect(){return Object.freeze({
    phase:closed?'closed':phase,
    phaseAtReturn,
    failed:primary!==undefined,
    failure:primary?.occurrence
      .error,
    failures:Object.freeze([...failures]),
    dispatches,
    unboundPending,
    unboundOutcomes,
    members:Object.freeze(records.map(record=>Object.freeze({
      ordinal:record.member
        .ordinal,
      arrival:record.arrival,
      state:record.state,
      completion:record.completion
    }))),
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
