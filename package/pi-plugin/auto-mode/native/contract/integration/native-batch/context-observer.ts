/**
 Observe original context callbacks synchronously around their native await sites.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import {
  NativeContextCaptureError,
  NativeContextContractError
} from './context-observer-errors.ts';
import type {
  NativeContextCompletion,
  NativeContextHandler,
  NativeContextInput,
  NativeContextKind,
  NativeContextSnapshot,
  NativeContextStage,
  NativeContextObserver,
  NativeContextObserverState
} from './context-observer-types.ts';

//region One observer owns one complete native context emission

/**
 Context observations retain a diagnostic boundary separate from native extension reporting.
 */
const l = tagged({tag:'auto-mode-native-context-observer'});

/** Original extension count remains inside the existing native source profile. */
const MAX_CONTEXT_EXTENSIONS=64;
/** Original callback traversal keeps the existing native handler limit. */
const MAX_CONTEXT_HANDLERS=256;

/**
 The emitter retains its original awaits; this owner checks traversal and captures original values.

 @param capture - original manager sink retaining source data under its existing budget

 @returns owned synchronous traversal observer for one native emission

 @example
 ```ts
 const observer=createNativeContextObserver(capture);
 ```
 */
export function createNativeContextObserver(capture: (input: NativeContextInput) => void): NativeContextObserver {
  /** Original traversal state belongs only to this invocation. */
  const state: NativeContextObserverState = {kinds:[],handlers:0,completed:false};
  /** Bound source capture is never replaced by returned handler data. */
  const rl=tagged({tag:createNativeContextObserver.name,l});
  rl.debug('created original context observer');

  /**
   Route complete values to the captured manager pool without exposing its capture capability.

   @param stage - current native callback position

   @param phase - original boundary at which the value was observed

   @param value - original input or result before any native field selection

   @throws NativeContextCaptureError when the original manager capture throws
   */
  function record({
    stage,
    phase,
    value
  }: {
    readonly stage: NativeContextStage;
    readonly phase: NativeContextInput['phase'];
    readonly value: unknown;
  }): void {
    /** Only the original active event can settle or receive source capture. */
    const {active} = stage;
    if (!active) throw new NativeContextContractError('Native context capture has no original callback');
    try {
      capture({
        kind:stage.kind,
        phase,
        ordinal:stage.next,
        path:active.slot
          .path,
        value
      });
    } catch (error) {
      throw new NativeContextCaptureError(error);
    }
  }
  /**
   Capture settled input before advancing the owned callback position.

   @param stage - current stage with its original active event

   @throws NativeContextContractError when settlement loses its original input
   */
  function settle(stage: NativeContextStage): void {
    /** Only the original active event can settle or receive source capture. */
    const {active} = stage;
    if (!active) throw new NativeContextContractError('Native context settlement has no original input');
    record({
      stage,
      phase:'after',
      value:active.event
    });
    delete stage.active;
    stage.next++;
  }


  /**
   Retain original handler order at Pi's existing snapshot boundary.

   @param kind - native callback stage whose snapshot has just been constructed

   @param snapshot - original extension references and copied handler lists

   @throws NativeContextContractError when traversal or extension metadata differs from the supported native shape
   */
  function begin({
    kind,
    snapshot
  }: {
    readonly kind: NativeContextKind;
    readonly snapshot: NativeContextSnapshot
  }): void {
    tagged({
      tag:begin.name,
      l
    })
      .debug('capturing original context traversal');
    if (state.completed || state.stage
      || (kind !== [
        'context',
        'context_with_system'
      ][state.kinds
        .length]))
      throw new NativeContextContractError('Native context stages must enter once in their original order');
    if (snapshot.length > MAX_CONTEXT_EXTENSIONS) throw new NativeContextContractError('Native context extensions exceed the original 64-source profile');
    /** Captured positions retain extension and handler identity in native order. */
    const slots = snapshot.flatMap(function captureOriginalSlots({
      ext,
      handlers
    }) {
      if (handlers.length > MAX_CONTEXT_HANDLERS) throw new NativeContextContractError('Native context handlers exceed the original 256-position profile');
      /** Read original extension metadata without invoking an accessor. */
      const path = Object.getOwnPropertyDescriptor(
        ext,
        'path'
      );
      if ((!path) || (!Object.hasOwn(
        path,
        'value'
      ))
        || ((typeof path.value) !== 'string'))
        throw new NativeContextContractError('Native context extension requires its original data path');
      /** Narrowed path remains stable after extension callbacks begin. */
      const capturedPath: string = path.value;
      return handlers.map(function captureOriginalHandler(handler) {
        return Object.freeze({
          extension:ext,
          handler,
          path:capturedPath
        });
      });
    });
    if (slots.length > MAX_CONTEXT_HANDLERS) throw new NativeContextContractError('Combined context handlers exceed the original 256-position profile');
    state.stage = {
      kind,
      slots:Object.freeze(slots),
      next:0
    };
  }

  /**
   Capture callback data before extension code can mutate or suppress it.

   @param extension - original extension from the current snapshot position

   @param handler - original callback at that position

   @param event - exact native input object supplied to this callback

   @throws NativeContextContractError when callback position, lifetime, or reentry differs
   */
  function before({
    extension,
    handler,
    event
  }: {
    readonly extension: object;
    readonly handler: NativeContextHandler;
    readonly event: unknown;
  }): void {
    tagged({
      tag:before.name,
      l
    })
      .debug('capturing original context callback input');
    /** Current original traversal supplies the callback position. */
    const stage = state.stage;
    /** Expected callback identity comes from the retained native snapshot. */
    const slot = stage?.slots[stage.next];
    if ((!stage) || stage.active
      || (!slot)
      || (slot.extension !== extension)
      || (slot.handler !== handler))
      throw new NativeContextContractError('Native context callback does not match its original ordered position');
    stage.active = {
      slot,
      event
    };
    record({
      stage,
      phase:'input',
      value:event
    });
  }

  /**
   Copy complete results and the settled input in the original native continuation.

   @param result - exact callback return before Pi selects its messages field

   @throws NativeContextContractError when no original callback is active
   */
  function returned(result: unknown): void {
    tagged({
      tag:returned.name,
      l
    })
      .debug('capturing original context callback result');
    /** Current original traversal supplies the callback position. */
    const stage = state.stage;
    if (!stage?.active) throw new NativeContextContractError('Native context result has no active callback');
    if (result !== undefined) record({
      stage,
      phase:'output',
      value:result
    });
    settle(stage);
  }

  /**
   Retain mutations made before a callback throws, preserving Pi's original error reporting.

   @param error - exact caught value from the native handler or result-processing boundary

   @throws original capture failure when this observer supplied the wrapper
   */
  function failed(error: unknown): void {
    NativeContextCaptureError.rethrow(error);
    tagged({
      tag:failed.name,
      l
    })
      .debug('native context callback or result processing threw; original native reporting retains its caught value');
    /** Current original traversal supplies the callback position. */
    const stage = state.stage;
    try {
      if (stage?.active) settle(stage);
    } catch (captureError) {
      NativeContextCaptureError.rethrow(captureError);
      throw captureError;
    }
  }

  /**
   Close only a fully traversed original callback snapshot.

   @param kind - native stage whose original loop has just ended

   @throws NativeContextContractError when callbacks remain pending or positions are omitted
   */
  function end(kind: NativeContextKind): void {
    tagged({
      tag:end.name,
      l
    })
      .debug('closing original context traversal');
    /** Current original traversal supplies the callback position. */
    const stage = state.stage;
    if ((!stage) || (stage.kind !== kind)
      || stage.active
      || (stage.next
        !== stage.slots
        .length))
      throw new NativeContextContractError('Native context traversal ended without every original callback observation');
    state.handlers += stage.next;
    state.kinds
      .push(kind);
    delete state.stage;
  }

  /**
   Publish a terminal receipt only after both original context traversals have completed.

   @returns immutable traversal receipt for the original run owner

   @throws NativeContextContractError when the emitter is pending, incomplete, or reused
   */
  function complete(): NativeContextCompletion {
    tagged({
      tag:complete.name,
      l
    })
      .debug('publishing original context completion');
    if (state.completed || state.stage
      || (state.kinds
        .length
        !== 2))
      throw new NativeContextContractError('Native context emission has no complete original traversal');
    state.completed = true;
    return Object.freeze({
      kinds:Object.freeze([...state.kinds]),
      handlers:state.handlers
    });
  }

  return Object.freeze({begin,before,returned,failed,end,complete});
}

//endregion One observer owns one complete native context emission
