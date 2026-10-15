import {RootLeaseError,RootLeaseOwnershipError,RootLeaseSuspendedError,RootLeaseRetiredError,RootTransitionError} from './lifecycle-errors.mjs';
//region Prepared transitions publish or retire their original canonical root.
export function createRootTransitions({emit,rootFor,active,transitions,observeNative,retired,retireRecord,unchangedEpoch,pending,ownedPair,exhausted,nativeOccurrence,leases,createRoot,issue}) {
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

 return {begin,beginRetirement,markMutation,cancelUnchanged,commit,completeRetirement,retireFailed,reopen};
}
//endregion
