import {RootLeaseError,RootLeaseOwnershipError,RootLeaseSuspendedError,RootLeaseRetiredError,RootTransitionError} from './lifecycle-errors.mjs';
import {createLifecycleDiagnostics} from './lifecycle-diagnostics.mjs';
import {createRootTransitions} from './lifecycle-transitions.mjs';
import {createRootConstructions} from './lifecycle-constructions.mjs';
export {RootLeaseError,RootLeaseOwnershipError,RootLeaseSuspendedError,RootLeaseRetiredError,RootTransitionError} from './lifecycle-errors.mjs';
//region Lifecycle leases share registry-owned epochs, not IDs, roles or mutable action metadata.
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
  const {emit,diagnostics,exclusive}=createLifecycleDiagnostics(trace);
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
  function readObservedNativeOccurrence(root){
    try{return nativeOccurrence({session:root.session,manager:root.manager});}
    catch(error){retireObserved(root);throw error;}
  }
  function observeNative(root){
    if((root.status==='retired')||exhausted(root.canonical)
      ||(root.canonical
        .epoch
        !==root.epoch)
      ||(!currentRoot(root)))return;
    const current=readObservedNativeOccurrence(root);
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
    const root=canonical.lifecycleRoot??createRoot({
      session,
      manager,
      canonical
    });
    if(root.session!==session)throw new RootLeaseOwnershipError('Manager has another session root; use an explicit transition or reopening');
    active(root);const lease=issue(root);active(root);return lease;
  }
  function assertActive(lease){emit('lifecycle.assert.entry');const root=rootFor(lease);active(root);emit('lifecycle.assert.active');active(root);}
  const {begin,beginRetirement,markMutation,cancelUnchanged,commit,completeRetirement,retireFailed,reopen}=createRootTransitions({emit,rootFor,active,transitions,observeNative,retired,retireRecord,unchangedEpoch,pending,ownedPair,exhausted,nativeOccurrence,leases,createRoot,issue});
  const {beginConstruction,bindConstruction,publishConstruction,abandonConstruction}=createRootConstructions({emit,stateFor,pending,unchangedEpoch,retired,exhausted,constructions,constructionCurrent,constructionFor,ownedPair,nativeOccurrence,active,leases,retireRecord,abandonedSessions});
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
