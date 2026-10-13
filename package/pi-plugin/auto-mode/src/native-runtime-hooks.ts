/**
 Original native runtime hook installation and cleanup.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region The native integration owns agent identity and all supplied capabilities

/**
 Native runtime setup or disposal boundary could not be established.
 */
export class NativePolicyRuntimeError extends Error {
  /** Stable diagnostic identity does not assert source authority. */
  override readonly name = 'NativePolicyRuntimeError';
}

/**
 Borrowed native slots; this helper neither authenticates nor freezes their owner.
 */
export type NativePolicyAgentSlots = {
  /** Native active-run signal, read without interpreting arbitrary truthiness. */
  readonly signal: unknown;
  /** Original provider stream slot remains opaque to installation bookkeeping. */
  streamFunction: unknown;
  /** Staged native complete-group executor slot. */
  executeToolBatch: unknown;
};

/**
 Original registration returns its own synchronous removal operation.
 */
export type NativePolicyHookRegistration = () => () => void;

/**
 Successful installation retains cleanup for the same original native lifetime.
 */
export type NativePolicyHookInstallation = {
  /** Require actual disposal and idle before releasing the executor slot. */
  readonly detach: () => void;
  /** Read installation state without creating an eligibility capability. */
  readonly isDetached: () => boolean;
};

/** Lifecycle logging never serializes borrowed agent slots or failure values. */
const l = tagged({ tag: 'auto-mode-native-runtime-hooks', },);

/**
 Install hooks after the caller establishes original native identity and an idle unoccupied agent.
 Registrations execute directly and return original removers, not interpreted descriptors.
 Failure cleanup preserves every original cause and leaves an incompletely cleaned executor occupied.
 Detachment leaves the invalidated request observer on the stream so a disposed root remains guarded.
 Borrowed capabilities stay live and mutable; only the returned method container is frozen.

 @param agent - original native slot owner authenticated by caller

 @param previousStream - original stream captured before dependent owner construction

 @param observedStream - fixed original-request observer stream

 @param executeToolBatch - fixed complete-group executor

 @param invalidateObserver - original observer's retirement operation

 @param registerJudgmentStart - original judgment-start hook registration

 @param registerExecutionTools - original execution-tool owner registration

 @param isSessionDisposed - fixed native disposal-completion reader

 @param onDetached - original runtime trace operation

 @returns cleanup lifetime for this installation only

 @throws NativePolicyRuntimeError when detach occurs before native disposal and idle

 @throws AggregateError when installation or removal has independent failures

 @throws original failure when rollback completes without another error

 @example
 ```ts
 const hooks = installNativePolicyHooks({
   agent, previousStream, observedStream, executeToolBatch,
   invalidateObserver, registerJudgmentStart, registerExecutionTools,
   isSessionDisposed, onDetached,
 });
 // Dispose the original Session and await its Agent before calling hooks.detach().
 ```
 */
export function installNativePolicyHooks(
  {
    agent,
    previousStream,
    observedStream,
    executeToolBatch,
    invalidateObserver,
    registerJudgmentStart,
    registerExecutionTools,
    isSessionDisposed,
    onDetached,
  }: {
    readonly agent: NativePolicyAgentSlots;
    readonly previousStream: unknown;
    readonly observedStream: unknown;
    readonly executeToolBatch: unknown;
    readonly invalidateObserver: () => void;
    readonly registerJudgmentStart: NativePolicyHookRegistration;
    readonly registerExecutionTools: NativePolicyHookRegistration;
    readonly isSessionDisposed: () => boolean;
    readonly onDetached: () => void;
  },
): NativePolicyHookInstallation {
  /** Attribute installation diagnostics to this module and function. */
  const rl = tagged({ tag: installNativePolicyHooks.name, l, },);
  rl.debug('installing original native runtime hooks',);
  /** Removal identities remain those returned by the original registrations. */
  const removals = new Set<() => void>([invalidateObserver,],);
  /** Detachment is a real lifecycle state, not an absent-value sentinel. */
  const state = { detached: false, };

  /**
   Remove in reverse installation order while retaining unsuccessful removers for retry.

   @throws AggregateError containing every original removal failure
   */
  function removeOwners(): void {
    /** Cleanup logs describe lifecycle only, not borrowed error objects. */
    const cl = tagged({ tag: removeOwners.name, l: rl, },);
    cl.debug('removing native owners in reverse installation order',);
    /** Independent failures must not prevent later cleanup operations. */
    const failures: unknown[] = [];
    for (const remove of [...removals,].reverse()) {
      try {
        remove();
        removals.delete(remove,);
      }
      catch (error) {
        failures.push(error,);
      }
    }
    if (failures.length > 0)
      throw new AggregateError(failures, 'Native policy owner cleanup remains pending',);
  }

  try {
    // Reserve the original executor slot before installing any other hook.
    agent.executeToolBatch = executeToolBatch;
    agent.streamFunction = observedStream;
    removals.add(registerJudgmentStart(),);
    removals.add(registerExecutionTools(),);
  }
  catch (error) {
    /** Preserve original installation failure before all independent rollback failures. */
    const failures: unknown[] = [error,];
    try {
      removeOwners();
    }
    catch (cleanupError) {
      failures.push(cleanupError,);
    }
    try {
      if (agent.streamFunction === observedStream)
        agent.streamFunction = previousStream;
    }
    catch (restoreError) {
      failures.push(restoreError,);
    }
    // Failed cleanup keeps the executor occupied instead of exposing an unguarded active agent.
    if (failures.length === 1) {
      try {
        if (agent.executeToolBatch === executeToolBatch)
          agent.executeToolBatch = undefined;
      }
      catch (restoreError) {
        failures.push(restoreError,);
      }
    }
    if (failures.length > 1) {
      throw new AggregateError(
        failures,
        'Native policy installation and cleanup failed; dispose the original session',
      );
    }
    throw error;
  }

  /**
   Release only after original disposal and Agent idle, with failed cleanup remaining retryable.

   @throws NativePolicyRuntimeError before original native disposal and idle

   @throws AggregateError when original removers leave pending cleanup
   */
  function detach(): void {
    /** Distinguish disposal gating from installation rollback. */
    const dl = tagged({ tag: detach.name, l: rl, },);
    dl.debug('checking native runtime detachment boundary',);
    if (state.detached)
      return;
    if ((!isSessionDisposed()) || (agent.signal !== undefined)) {
      throw new NativePolicyRuntimeError(
        'Dispose the original session and await its agent run before detaching policy ownership',
      );
    }
    removeOwners();
    if (agent.executeToolBatch === executeToolBatch)
      agent.executeToolBatch = undefined;
    state.detached = true;
    onDetached();
  }

  /**
   Read the installation's current cleanup state without claiming native liveness.

   @returns whether this installation finished its detachment operations
   */
  function isDetached(): boolean {
    return state.detached;
  }

  return Object.freeze({ detach, isDetached, },);
}

//endregion Original native hook lifetime
