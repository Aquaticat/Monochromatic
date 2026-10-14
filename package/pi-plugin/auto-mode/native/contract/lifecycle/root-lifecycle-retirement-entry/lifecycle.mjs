//region Lifecycle leases share registry-owned epochs, not IDs, roles or mutable action metadata.
export class RootLeaseError extends Error {constructor(
  message,
  options
){super(
  message,
  options
);this.name=this.constructor
  .name;}}
export class RootLeaseOwnershipError extends RootLeaseError {}
export class RootLeaseSuspendedError extends RootLeaseError {}
export class RootLeaseRetiredError extends RootLeaseError {}
export class RootTransitionError extends RootLeaseError {}
function reference(value){return (value!==null)&&(((typeof value)==='object')||((typeof value)==='function'));}

/** Observe the trusted native root occurrence while preserving registry ownership and transient suspension. */
export function createLifecyclePath({
  stateFor,
  sessionOwner,
  trace,
  readRootOccurrence
}) {
  const leases=new WeakMap();
    const transitions=new WeakMap();
    const sessionManagers=new WeakMap();
    const constructions=new WeakMap();
    const abandonedSessions=new WeakSet();
    const traceFailures=[];
  let busy=false;
    let suppressedTraceEvents=0;
    let traceDisabled=false;
  // Diagnostics cannot hide a returned handle or change an operation's completion outcome.
  function emit(event){
    if(traceDisabled){suppressedTraceEvents+=1;return;}
    try{trace(event);}catch(error){traceFailures.push(error);if(traceFailures.length===64)traceDisabled=true;}
  }
  function diagnostics(){return Object.freeze({
    traceFailures:Object.freeze([...traceFailures]),
    traceDisabled,
    suppressedTraceEvents
  });}
  function exclusive(operation){
    if(busy)throw new RootTransitionError('Lifecycle operations cannot reenter through callbacks');
    busy=true;try{return operation();}finally{busy=false;}
  }
  function ownedPair({
    session,
    manager
  }) {
    if((!reference(session))||(!reference(manager)))throw new RootLeaseOwnershipError('Root requires exact session and manager objects');
    if(abandonedSessions.has(session))throw new RootLeaseOwnershipError('Session belongs to an abandoned construction; construct another session');
    if((typeof sessionOwner?.assertOwned)!=='function')throw new RootLeaseOwnershipError('Session construction owner is unavailable');
    sessionOwner.assertOwned({
      session,
      manager
    });
    const known=sessionManagers.get(session);
    if(known&&(known!==manager))throw new RootLeaseOwnershipError('Session object is already paired with another manager');
    const canonical=stateFor(manager);sessionManagers.set(
      session,
      manager
    );return canonical;
  }
  function exhausted(canonical){return (canonical.exhausted===true)||(!Number.isSafeInteger(canonical.epoch))
    ||(canonical.epoch<0);}
  function nativeOccurrence({
    session,
    manager
  }){
    if((typeof readRootOccurrence)!=='function')throw new RootLeaseOwnershipError('Trusted native root occurrence reader is unavailable');
    const value=readRootOccurrence({
      session,
      manager
    });
    if((value===null)||((typeof value)!=='object')
      ||(!Object.isFrozen(value)))throw new RootLeaseOwnershipError('Native root occurrence must be an immutable opaque object');
    return value;
  }
  function retireRecord(root){
    if(root.status==='retired')return false;
    if(exhausted(root.canonical)||(root.canonical
      .epoch
      ===Number.MAX_SAFE_INTEGER)){root.canonical
        .exhausted=true;root.canonical
          .epoch=Infinity;}
    else root.canonical
      .epoch+=1;
    root.status='retired';return true;
  }
  function retireObserved(root){
    const changed=retireRecord(root);
      const operation=root.canonical
        .pendingTransition;
    if(changed&&operation
      &&(operation.root===root)
      &&(operation.state==='pending')){operation.dirty=true;operation.expectedEpoch=root.canonical
        .epoch;}
    if(changed)emit('lifecycle.root.retired');
  }
  function currentRoot(root){return (root.canonical
    .lifecycleRoot
    ===root)||(root.canonical
      .construction
      ?.candidate
      ===root);}
  function observeNative(root){
    if((root.status==='retired')||exhausted(root.canonical)
      ||(root.canonical
        .epoch
        !==root.epoch)
      ||(!currentRoot(root)))return;
    let current;
    try{current=nativeOccurrence({
      session:root.session,
      manager:root.manager
    });}catch(error){retireObserved(root);throw error;}
    if(current!==root.nativeOccurrence){retireObserved(root);emit('lifecycle.native-occurrence.changed');}
  }
  function retired(root){observeNative(root);return (root.status==='retired')||exhausted(root.canonical)
    ||(root.canonical
      .epoch
      !==root.epoch)
    ||(!currentRoot(root));}
  function rootFor(lease){const root=reference(lease)?leases.get(lease):undefined;if(!root)throw new RootLeaseOwnershipError('Lease is not issued by this registry');return root;}
  function pending(token) {
    const operation=reference(token)?transitions.get(token):undefined;
    if(!operation)throw new RootLeaseOwnershipError('Transition is not issued by this registry');
    if((operation.state!=='pending')||(operation.root
      .canonical
      .pendingTransition
      !==operation))throw new RootTransitionError('Transition has already finished or lost its manager binding');
    return operation;
  }
  function unchangedEpoch(operation){observeNative(operation.root);if(operation.root
    .canonical
    .epoch
    !==operation.expectedEpoch)throw new RootTransitionError('Manager epoch changed outside this pending transition');}
  function constructionFor(token){
    const record=reference(token)?constructions.get(token):undefined;
    if(!record)throw new RootLeaseOwnershipError('Construction is not issued by this registry');
    return record;
  }
  function constructionCurrent(record){
    if((![
      'reserved',
      'binding',
      'bound'
    ].includes(record.state))||(record.canonical
      .construction
      !==record))throw new RootTransitionError('Construction has finished or lost its manager reservation');
    if(exhausted(record.canonical)||(record.canonical
      .epoch
      !==record.expectedEpoch)
      ||(record.canonical
        .lifecycleRoot
        !==record.previousRoot))throw new RootTransitionError('Construction manager changed outside this occurrence');
    const {operation} = record;
    if(record.canonical
      .pendingTransition
      &&(record.canonical
        .pendingTransition
        !==operation))throw new RootTransitionError('Construction manager has another pending transition');
    if(operation){pending(operation.token);unchangedEpoch(operation);if((!operation.dirty)||(operation.root
      .status
      !=='retired'))throw new RootTransitionError('Construction source must remain retired');}
  }
  function active(root){
    const {construction} = root.canonical;
    if(construction?.candidate===root){try{constructionCurrent(construction);}catch(error){retireRecord(root);throw error;}}
    if(retired(root))throw new RootLeaseRetiredError('Root lease has been retired');
    if(root.status==='suspended')throw new RootLeaseSuspendedError('Root transition is pending');
    if(root.status!=='active')throw new RootTransitionError('Root lifecycle state is unsupported');
  }
  function issue(root){const lease=Object.freeze({});leases.set(
    lease,
    root
  );emit('lifecycle.lease.issued');return lease;}
  function createRoot({
    session,
    manager,
    canonical
  }) {
    if(exhausted(canonical))throw new RootLeaseRetiredError('Manager epoch is exhausted; construct another manager');
    const root={
      session,
      manager,
      canonical,
      epoch:canonical.epoch,
      nativeOccurrence:nativeOccurrence({
        session,
        manager
      }),
      status:'active'
    };
    canonical.lifecycleRoot=root;emit('lifecycle.root.created');return root;
  }
  function capture({
    session,
    manager
  }) {
    emit('lifecycle.capture.entry');const canonical=ownedPair({
      session,
      manager
    });
    const {construction} = canonical;
    if(construction){
      if((construction.state!=='bound')||(construction.session!==session))throw new RootLeaseSuspendedError('Manager construction is pending for another or unbound session');
      const root=construction.candidate;active(root);const lease=issue(root);active(root);return lease;
    }
    if(canonical.pendingTransition)throw new RootLeaseSuspendedError('Manager transition is pending');
    let root=canonical.lifecycleRoot;
    if(!root)root=createRoot({
      session,
      manager,
      canonical
    });
    else if(root.session!==session)throw new RootLeaseOwnershipError('Manager has another session root; use an explicit transition or reopening');
    active(root);const lease=issue(root);active(root);return lease;
  }
  function assertActive(lease){emit('lifecycle.assert.entry');const root=rootFor(lease);active(root);emit('lifecycle.assert.active');active(root);}
  function begin(lease) {
    emit('lifecycle.begin.entry');const root=rootFor(lease);active(root);
    if(root.canonical
      .construction)throw new RootTransitionError('Constructing root cannot begin another transition');
    if(root.canonical
      .pendingTransition)throw new RootTransitionError('Manager already has a pending transition');
    const token=Object.freeze({});
    const operation={
      root,
      token,
      expectedEpoch:root.canonical
        .epoch,
      state:'pending',
      dirty:false
    };
    root.status='suspended';root.canonical
      .pendingTransition=operation;transitions.set(
      token,
      operation
    );emit('lifecycle.begin.suspended');
    try{
      observeNative(root);
      if(root.canonical
        .epoch
        !==operation.expectedEpoch)throw new RootTransitionError('Manager epoch changed before transition publication');
      if(retired(root))throw new RootLeaseRetiredError('Root retired before transition publication');
      return token;
    }catch(error){
      // The token never escaped, so failure cleanup belongs here rather than to the caller.
      const changed=retireRecord(root);operation.state='failed';root.canonical
        .pendingTransition=undefined;
      if(changed)emit('lifecycle.root.retired');emit('lifecycle.transition.failed');throw error;
    }
  }
  /** Terminal cleanup invalidates an owned current root without requiring a usable native liveness reader. */
  function beginRetirement(lease){
    emit('retirement.begin.entry');const root=rootFor(lease);
    const {canonical} = root;
    if(canonical.lifecycleRoot!==root)throw new RootTransitionError('Terminal retirement requires this manager\'s current canonical root');
    if(canonical.pendingTransition||canonical.construction)throw new RootTransitionError('Terminal retirement cannot overlap another transition or construction');
    const changed=retireRecord(root);
    const token=Object.freeze({});
    const operation={
      root,
      token,
      expectedEpoch:canonical.epoch,
      state:'pending',
      dirty:true,
      terminalOnly:true
    };
    canonical.pendingTransition=operation;transitions.set(
      token,
      operation
    );
    try{
      if(changed)emit('lifecycle.root.retired');emit('retirement.begin.prepared');
      unchangedEpoch(operation);pending(token);
      if((canonical.lifecycleRoot!==root)||canonical.construction)throw new RootTransitionError('Terminal root changed before retirement publication');
      return token;
    }catch(error){operation.state='failed';if(canonical.pendingTransition===operation)canonical.pendingTransition=undefined;throw error;}
  }
  function retireRoot(operation) {if(retireRecord(operation.root)){operation.expectedEpoch=operation.root
    .canonical
    .epoch;emit('lifecycle.root.retired');}}
  function finish({
    operation,
    state
  }){operation.state=state;operation.root
    .canonical
    .pendingTransition=undefined;emit(`lifecycle.transition.${state}`);}
  function markMutation(token) {
    emit('lifecycle.mark.entry');const operation=pending(token);unchangedEpoch(operation);
    if(operation.dirty)throw new RootTransitionError('Possible mutation was already marked');
    operation.dirty=true;retireRoot(operation);emit('lifecycle.mark.possible-mutation');
  }
  function assertCancellable(operation){
    unchangedEpoch(operation);
    if(operation.dirty||retired(operation.root))throw new RootTransitionError('A possibly mutating transition cannot restore its old lease');
  }
  /** Only the trusted managed operation owner can establish unchanged cancellation. Absence of an event is insufficient. */
  function cancelUnchanged(token) {
    emit('lifecycle.cancel.entry');const operation=pending(token);assertCancellable(operation);
    emit('lifecycle.cancel.prepared');assertCancellable(operation);
    // Publication tail has no callbacks; failed preparation leaves cleanup available.
    operation.root
      .status='active';operation.state='cancelled';operation.root
        .canonical
        .pendingTransition=undefined;
  }
  function commit({
    transition,
    session,
    manager
  }) {
    emit('lifecycle.commit.entry');const operation=pending(transition);
    if(operation.terminalOnly)throw new RootTransitionError('Terminal retirement cannot publish a replacement');
    unchangedEpoch(operation);
    const canonical=ownedPair({
      session,
      manager
    }); const existing=canonical.lifecycleRoot;
    if(canonical.construction)throw new RootTransitionError('Replacement manager belongs to a pending construction');
    if(exhausted(canonical)||(canonical.epoch===Number.MAX_SAFE_INTEGER))throw new RootTransitionError('Replacement epoch cannot issue another root; retire this transition');
    if(canonical.pendingTransition&&(canonical.pendingTransition!==operation))throw new RootTransitionError('Replacement manager has another pending transition');
    if(existing&&(existing!==operation.root)
      &&(!retired(existing)))throw new RootTransitionError('Replacement manager already has an active root');
    unchangedEpoch(operation);
    if(exhausted(canonical)||(canonical.epoch===Number.MAX_SAFE_INTEGER))throw new RootTransitionError('Observed replacement epoch cannot issue another root; retire this transition');
    const replacementEpoch=canonical.epoch;
    const replacementOccurrence=nativeOccurrence({
      session,
      manager
    });
    unchangedEpoch(operation);
    if((canonical.epoch!==replacementEpoch)||(canonical.lifecycleRoot!==existing))throw new RootTransitionError('Replacement changed during native observation');
    retireRoot(operation);unchangedEpoch(operation);
    const expectedEpoch=canonical
      ===operation.root
      .canonical?operation.expectedEpoch:replacementEpoch;
    const root={
      session,
      manager,
      canonical,
      epoch:expectedEpoch,
      nativeOccurrence:replacementOccurrence,
      status:'active'
    }; const lease=Object.freeze({});
    emit('lifecycle.commit.root-prepared');emit('lifecycle.commit.lease-prepared');emit('lifecycle.commit.prepared');
    unchangedEpoch(operation);
    if(exhausted(canonical)||(canonical.epoch!==expectedEpoch)
      ||(canonical.lifecycleRoot!==existing)
      ||(canonical.pendingTransition&&(canonical.pendingTransition!==operation)))throw new RootTransitionError('Replacement changed before root publication');
    if(nativeOccurrence({
      session,
      manager
    })!==replacementOccurrence)throw new RootTransitionError('Replacement native occurrence changed before root publication');
    unchangedEpoch(operation);
    // All allocation, native reads and callbacks precede this non-callback publication tail.
    canonical.lifecycleRoot=root;operation.state='committed';operation.root
      .canonical
      .pendingTransition=undefined;leases.set(
      lease,
      root
    );return lease;
  }
  /** Finish an already-retired transition without issuing a replacement root. */
  function completeRetirement(transition) {
    emit('lifecycle.close.entry');const operation=pending(transition);unchangedEpoch(operation);
    if((!operation.dirty)||(operation.root
      .status
      !=='retired'))throw new RootTransitionError('Terminal completion requires pre-effect retirement');
    emit('lifecycle.close.prepared');unchangedEpoch(operation);
    // No callback or fallible reader follows successful terminal publication.
    operation.state='closed';operation.root
      .canonical
      .pendingTransition=undefined;
  }
  function retireFailed(transition) {
    emit('lifecycle.fail.entry');const operation=pending(transition);
    // Even an unexpected epoch advance or exhaustion can terminate the pending state, never restore it.
    retireRoot(operation);finish({
      operation,
      state:'failed'
    });
  }
  /** Explicit constructor-owner recovery creates another occurrence; it never revives an earlier lease. */
  function reopen({
    session,
    manager
  }) {
    emit('lifecycle.reopen.entry');const canonical=ownedPair({
      session,
      manager
    }); const root=canonical.lifecycleRoot;
    if(canonical.construction)throw new RootLeaseSuspendedError('Manager construction is pending');
    if(canonical.pendingTransition)throw new RootLeaseSuspendedError('Manager transition is pending');
    if((!root)||(!retired(root)))throw new RootTransitionError('Reopening requires a previously retired root');
    const next=createRoot({
      session,
      manager,
      canonical
    }); const lease=issue(next);active(next);return lease;
  }

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

  return Object.freeze({
    beginConstruction:function beginExclusiveConstruction(input) { return (exclusive(function reserveConstruction() { return (beginConstruction(input)); })); },
    bindConstruction:function bindExclusiveConstruction(input) { return (exclusive(function bindReservedConstruction() { bindConstruction(input); })); },
    publishConstruction:function publishExclusiveConstruction(token) { return (exclusive(function publishReservedConstruction() { return (publishConstruction(token)); })); },
    abandonConstruction:function abandonExclusiveConstruction(token) { return (exclusive(function abandonReservedConstruction() { return (abandonConstruction(token)); })); },
    capture:function captureExclusiveLease(input) { return (exclusive(function captureCurrentLease() { return (capture(input)); })); },
    assertActive:function assertExclusiveLease(lease) { return (exclusive(function assertCurrentLease() { assertActive(lease); })); },
    beginRetirement:function beginExclusiveRetirement(lease) { return (exclusive(function prepareTerminalRetirement() { return (beginRetirement(lease)); })); },
    begin:function beginExclusiveTransition(lease) { return (exclusive(function prepareRootTransition() { return (begin(lease)); })); },
    markMutation:function markExclusiveMutation(token) { return (exclusive(function markPossibleMutation() { markMutation(token); })); },
    cancelUnchanged:function cancelExclusiveTransition(token) { return (exclusive(function cancelUnchangedTransition() { cancelUnchanged(token); })); },
    commit:function commitExclusiveTransition(input) { return (exclusive(function commitPreparedTransition() { return (commit(input)); })); },
    completeRetirement:function completeExclusiveRetirement(token) { return (exclusive(function completeTerminalRetirement() { completeRetirement(token); })); },
    retireFailed:function failExclusiveTransition(token) { return (exclusive(function retireFailedTransition() { retireFailed(token); })); },
    reopen:function reopenExclusiveRoot(input) { return (exclusive(function reopenCurrentRoot() { return (reopen(input)); })); },
    diagnostics,
  });
}
//endregion
