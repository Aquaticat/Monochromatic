import {RootLeaseError,RootLeaseOwnershipError,RootLeaseSuspendedError,RootLeaseRetiredError,RootTransitionError} from './lifecycle-errors.mjs';
export function createRootConstructions({emit,stateFor,pending,unchangedEpoch,retired,exhausted,constructions,constructionCurrent,constructionFor,ownedPair,nativeOccurrence,active,leases,retireRecord,abandonedSessions}) {
  //region Factory occurrences share canonical manager state; observation does not confer human authority.
  function beginConstruction({
    manager,
    transition
  }){
    emit('construction.begin.entry');
    const canonical=stateFor(manager);
    const operation=transition===undefined?undefined:pending(transition);
    if(operation?.terminalOnly)throw new RootTransitionError('Terminal retirement cannot start a construction');
    if(operation){unchangedEpoch(operation);if((!operation.dirty)||(operation.root
      .status
      !=='retired'))throw new RootTransitionError('Replacement construction requires pre-effect retirement');}
    if(canonical.construction)throw new RootTransitionError('Manager already has a pending construction');
    if(canonical.pendingTransition&&(canonical.pendingTransition!==operation))throw new RootTransitionError('Construction manager has another pending transition');
    const previousRoot=canonical.lifecycleRoot;
    if(previousRoot&&(!retired(previousRoot)))throw new RootTransitionError('Construction manager already has an active root');
    if(exhausted(canonical)||(canonical.epoch===Number.MAX_SAFE_INTEGER))throw new RootTransitionError('Construction epoch cannot issue another root');
    const token=Object.freeze({});
      const record={
      token,
      manager,
      canonical,
      operation,
      previousRoot,
      expectedEpoch:canonical.epoch,
      state:'reserved',
      candidate:undefined,
      session:undefined
    };
    canonical.construction=record;constructions.set(
      token,
      record
    );
    try{emit('construction.begin.prepared');constructionCurrent(record);return token;}
    catch(error){record.state='abandoned';if(canonical.construction===record)canonical.construction=undefined;throw error;}
  }
  function bindConstruction({
    construction,
    session
  }){
    emit('construction.bind.entry');const record=constructionFor(construction);constructionCurrent(record);
    if(record.state!=='reserved')throw new RootTransitionError('Construction session registration was already attempted');
    record.state='binding';
    const canonical=ownedPair({
      session,
      manager:record.manager
    });
    if(canonical!==record.canonical)throw new RootLeaseOwnershipError('Construction manager pairing changed');
    if(record.previousRoot
      ?.session
      ===session)throw new RootLeaseOwnershipError('Construction cannot reuse a previous root session');
    record.session=session;
    const occurrence=nativeOccurrence({
      session,
      manager:record.manager
    });
    const candidate={
      session,
      manager:record.manager,
      canonical,
      epoch:record.expectedEpoch,
      nativeOccurrence:occurrence,
      status:'active'
    };
    emit('construction.bind.prepared');constructionCurrent(record);
    if(nativeOccurrence({
      session,
      manager:record.manager
    })!==occurrence)throw new RootTransitionError('Construction native occurrence changed during registration');
    constructionCurrent(record);
    record.candidate=candidate;record.state='bound';
  }
  function publishConstruction(construction){
    emit('construction.publish.entry');const record=constructionFor(construction);constructionCurrent(record);
    if(record.state!=='bound')throw new RootTransitionError('Construction has no registered candidate session');
    const {candidate} = record;
    const lease=Object.freeze({});
    function validate(){
      const canonical=ownedPair({
        session:record.session,
        manager:record.manager
      });
      if(canonical!==record.canonical)throw new RootLeaseOwnershipError('Construction manager pairing changed');
      constructionCurrent(record);active(candidate);constructionCurrent(record);
    }
    validate();emit('construction.publish.prepared');validate();
    // All callbacks and native reads precede publication. Preserve existing candidate observation leases.
    record.canonical
      .lifecycleRoot=candidate;record.canonical
        .construction=undefined;record.state='published';
    if(record.operation){record.operation
      .state='committed';record.operation
        .root
        .canonical
        .pendingTransition=undefined;}
    leases.set(
      lease,
      candidate
    );return lease;
  }
  function abandonConstruction(construction){
    emit('construction.abandon.entry');const record=constructionFor(construction);
    if(record.state==='abandoned')return Object.freeze({session:record.session});
    if(record.state==='published')throw new RootTransitionError('Published construction cannot be abandoned');
    if(record.canonical
      .construction
      !==record)throw new RootTransitionError('Construction lost its manager reservation');
    // Failure cleanup does not depend on an unchanged epoch or a usable native reader.
    if(record.candidate)retireRecord(record.candidate);
    if(record.session)abandonedSessions.add(record.session);
    record.state='abandoned';record.canonical
      .construction=undefined;
    return Object.freeze({session:record.session});
  }
  //endregion

 return {beginConstruction,bindConstruction,publishConstruction,abandonConstruction};
}
