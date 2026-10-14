/**
 Observe one original native event traversal without replacing its callback await sites.

 @module
 */
import {
  tagged,
  type Logger
} from '@monochromatic-dev/module-logger/ts';
import {
  NativeEventCaptureError,
  NativeEventContractError
} from './event-observer-errors.ts';
import type {
  NativeEventInput,
  NativeEventSlot,
  NativeEventTraversal
} from './event-observer-types.ts';

//region A native invocation owns ordered callback observations until its original return or throw

/**
 Retain complete input and output values through the original manager capture callback.

 @param kind - original event kind selected by native dispatch
 
 @param slots - original ordered callback positions
 
 @param capture - original manager source sink
 
 @param retire - owner notification after this original emission closes
 
 @param invalidate - owner notification when observation itself fails
 
 @param l - tagged owner diagnostics
 
 @returns synchronous boundaries surrounding Pi's unchanged awaits

 @example
 ```ts
 const traversal=createNativeEventTraversal({kind,slots,capture,retire,invalidate,l});
 ```
 */
export function createNativeEventTraversal({
  kind,
  slots,
  capture,
  retire,
  invalidate,
  l
}: {
  readonly kind: string;
  readonly slots: readonly NativeEventSlot[];
  readonly capture: (input: NativeEventInput) => void;
  readonly retire: () => void;
  readonly invalidate: () => void;
  readonly l: Logger;
}): NativeEventTraversal {
  /**
   Original traversal progress remains private to this emission.
   */
  const state: {
    next: number;
    closed: boolean;
    active?: {
      readonly slot: NativeEventSlot;
      readonly event: unknown
    };
  } = {
    next: 0,
    closed: false
  };
  /**
   Function diagnostics retain the original owner's tags.
   */
  const rl = tagged({
    tag: createNativeEventTraversal.name,
    l
  });
  rl.debug('created original native event traversal');

  /**
   Make observation contract failures escape native extension-error handling.

   @param message - affected original traversal boundary
   
   @throws NativeEventCaptureError carrying the original contract error
   */
  function reject(message: string): never {
    tagged({
      tag:reject.name,
      l:rl
    })
      .debug('original native event traversal differs');
    invalidate();
    throw new NativeEventCaptureError(new NativeEventContractError(message));
  }

  /**
   Capture values before native field selection or later queued mutation.

   @param phase - original observed boundary
   
   @param value - complete value passed to the manager's existing bounded copier
   
   @throws NativeEventCaptureError when the original source sink throws
   */
  function record({
    phase,
    value
  }: {
    readonly phase:NativeEventInput['phase'];
    readonly value:unknown
  }): void {
    tagged({
      tag:record.name,
      l:rl
    })
      .debug('retaining original native event value');
    /**
     Original active position supplies immutable path and ordinal metadata.
     */
    const {active}=state;
    if(!active)reject('Native event capture has no original active callback');
    try {
      capture({
        kind,
        phase,
        ordinal:state.next,
        path:active.slot
          .path,
        value
      });
    } catch(error) {
      invalidate();
      throw new NativeEventCaptureError(error);
    }
  }

  /**
   Retain mutations made before callback completion or rejection.

   @throws NativeEventCaptureError when no original input remains active
   */
  function settle(): void {
    tagged({
      tag:settle.name,
      l:rl
    })
      .debug('retaining settled native event input');
    /**
     Original event identity is retained across the native await.
     */
    const {active}=state;
    if(!active)reject('Native event settlement has no original input');
    record({
      phase:'after',
      value:active.event
    });
    delete state.active;
    state.next++;
  }

  /**
   Capture the original input only at its ordered native callback position.

   @param extension - original extension from the native snapshot
   
   @param handler - original callback selected by native traversal
   
   @param event - exact mutable event before callback invocation
   
   @throws NativeEventCaptureError when position or lifetime differs
   */
  function before({
    extension,
    handler,
    event
  }: Parameters<NativeEventTraversal['before']>[0]): void {
    tagged({
      tag:before.name,
      l:rl
    })
      .debug('capturing original native event input');
    /**
     Original copied snapshot fixes the next callable position.
     */
    const slot=slots[state.next];
    if(state.closed||state.active
      ||(!slot)
      ||(slot.extension!==extension)
      ||(slot.handler!==handler))
      reject('Native event callback differs from its original ordered position');
    state.active={
      slot,
      event
    };
    record({
      phase:'input',
      value:event
    });
  }

  /**
   Capture complete returned data before Pi consumes selected fields.

   @param value - original settled callback result
   
   @throws NativeEventCaptureError when no original callback can settle
   */
  function returned(value: unknown): void {
    tagged({
      tag:returned.name,
      l:rl
    })
      .debug('capturing original native event result');
    if(state.closed||(!state.active))reject('Native event result has no original active callback');
    if(value!==undefined)record({
      phase:'output',
      value
    });
    settle();
  }

  /**
   Preserve native handler errors while retaining their last input mutation.

   @param error - exact value caught by Pi's original callback handler
   
   @throws NativeEventCaptureError when observation supplied the failure
   */
  function failed(error: unknown): void {
    tagged({
      tag:failed.name,
      l:rl
    })
      .debug('observing original native callback failure');
    if(NativeEventCaptureError.isOriginal(error))throw error;
    if(state.active)settle();
  }

  /**
   Close an observed original emission exactly once.
   */
  function close(): void {
    tagged({
      tag:close.name,
      l:rl
    })
      .debug('retiring original native event traversal');
    state.closed=true;
    retire();
  }

  /**
   Complete only after every original callback position has settled.

   @throws NativeEventCaptureError when native traversal omits a position
   */
  function end(): void {
    tagged({
      tag:end.name,
      l:rl
    })
      .debug('completing original native event traversal');
    if(state.closed||state.active
      ||(state.next!==slots.length))
      reject('Native event traversal ended before every original callback observation');
    close();
  }

  /**
   Close at Pi's original cancellation, block, or handled-result return.

   @throws NativeEventCaptureError when no settled callback precedes the native return
   */
  function stopped(): void {
    tagged({
      tag:stopped.name,
      l:rl
    })
      .debug('observing original native event early return');
    if(state.closed||state.active
      ||(state.next===0))
      reject('Native event early return requires its original settled callback');
    close();
  }

  /**
   Retire a natively thrown emission without changing the original error value.

   @param error - exact value leaving the original native method
   
   @throws original source-capture failure after the emission is retired
   */
  function aborted(error: unknown): void {
    tagged({
      tag:aborted.name,
      l:rl
    })
      .debug('observing original native event abort');
    if(NativeEventCaptureError.isOriginal(error)) {
      invalidate();
      if(!state.closed)close();
      error.rethrow();
    }
    if(state.closed)return;
    try {
      failed(error);
    } catch(captureError) {
      invalidate();
      close();
      if(NativeEventCaptureError.isOriginal(captureError))captureError.rethrow();
      throw captureError;
    }
    close();
  }

  return Object.freeze({
    before,
    returned,
    failed,
    end,
    stopped,
    aborted
  });
}

//endregion A native invocation owns ordered callback observations until its original return or throw
