/**
 Observe original context callbacks synchronously around their native await sites.

 @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { NativeContextCaptureFailure, NativeContextContractError } from './context-observer-errors.ts';
import type {
  NativeContextCompletion,
  NativeContextHandler,
  NativeContextInput,
  NativeContextKind,
  NativeContextSnapshot,
  NativeContextStage
} from './context-observer-types.ts';

//region One observer owns one complete native context emission

/** Context observations retain a diagnostic boundary separate from native extension reporting. */
const l = tagged({tag:'auto-mode-native-context-observer'});

/**
 The emitter retains its original awaits; this owner checks traversal and captures original values.
 */
export class NativeContextObserver {
  readonly #capture: (input: NativeContextInput) => void;
  readonly #kinds: NativeContextKind[] = [];
  #stage: NativeContextStage | undefined;
  #handlers = 0;
  #completed = false;

  /**
   Capture the manager-owned source sink once for this emitter invocation.

   @param capture - original manager input pool retaining values under its existing shared budget
   */
  constructor(capture: (input: NativeContextInput) => void) {
    this.#capture = capture;
    tagged({tag:NativeContextObserver.name,l}).debug('created original context observer');
  }

  /**
   Retain original handler order at Pi's existing snapshot boundary.

   @param kind - native callback stage whose snapshot has just been constructed

   @param snapshot - original extension references and copied handler lists

   @throws NativeContextContractError when traversal or extension metadata differs from the supported native shape
   */
  begin({kind,snapshot}: {readonly kind: NativeContextKind; readonly snapshot: NativeContextSnapshot}): void {
    tagged({tag:this.begin.name,l}).debug('capturing original context traversal');
    if (this.#completed || this.#stage || kind !== ['context','context_with_system'][this.#kinds.length])
      throw new NativeContextContractError('Native context stages must enter once in their original order');
    if (snapshot.length > 64) throw new NativeContextContractError('Native context extensions exceed the original 64-source profile');
    const slots = snapshot.flatMap(function captureOriginalSlots({ext,handlers}) {
      if (handlers.length > 256) throw new NativeContextContractError('Native context handlers exceed the original 256-position profile');
      const path = Object.getOwnPropertyDescriptor(ext,'path');
      if (!path || !Object.hasOwn(path,'value') || typeof path.value !== 'string')
        throw new NativeContextContractError('Native context extension requires its original data path');
      const capturedPath: string = path.value;
      return handlers.map(function captureOriginalHandler(handler) {
        return Object.freeze({extension:ext,handler,path:capturedPath});
      });
    });
    if (slots.length > 256) throw new NativeContextContractError('Combined context handlers exceed the original 256-position profile');
    this.#stage = {kind,slots:Object.freeze(slots),next:0,active:undefined};
  }

  /**
   Capture callback data before extension code can mutate or suppress it.

   @param extension - original extension from the current snapshot position

   @param handler - original callback at that position

   @param event - exact native input object supplied to this callback

   @throws NativeContextContractError when callback position, lifetime, or reentry differs
   */
  before({extension,handler,event}: {
    readonly extension: object;
    readonly handler: NativeContextHandler;
    readonly event: unknown;
  }): void {
    tagged({tag:this.before.name,l}).debug('capturing original context callback input');
    const stage = this.#stage;
    const slot = stage?.slots[stage.next];
    if (!stage || stage.active || !slot || slot.extension !== extension || slot.handler !== handler)
      throw new NativeContextContractError('Native context callback does not match its original ordered position');
    stage.active = {slot,event};
    this.#record({stage,phase:'input',value:event});
  }

  /**
   Copy complete results and the settled input in the original native continuation.

   @param result - exact callback return before Pi selects its messages field

   @throws NativeContextContractError when no original callback is active
   */
  returned(result: unknown): void {
    tagged({tag:this.returned.name,l}).debug('capturing original context callback result');
    const stage = this.#stage;
    if (!stage?.active) throw new NativeContextContractError('Native context result has no active callback');
    if (result !== undefined) this.#record({stage,phase:'output',value:result});
    this.#settle(stage);
  }

  /**
   Retain mutations made before a callback throws, preserving Pi's original error reporting.

   @param error - exact caught value from the native handler or result-processing boundary

   @throws original capture failure when this observer supplied the wrapper
   */
  failed(error: unknown): void {
    NativeContextCaptureFailure.rethrow(error);
    tagged({tag:this.failed.name,l}).debug('native context callback or result processing threw; original native reporting retains its caught value');
    const stage = this.#stage;
    try {
      if (stage?.active) this.#settle(stage);
    } catch (captureError) {
      NativeContextCaptureFailure.rethrow(captureError);
      throw captureError;
    }
  }

  /**
   Close only a fully traversed original callback snapshot.

   @param kind - native stage whose original loop has just ended

   @throws NativeContextContractError when callbacks remain pending or positions are omitted
   */
  end(kind: NativeContextKind): void {
    tagged({tag:this.end.name,l}).debug('closing original context traversal');
    const stage = this.#stage;
    if (!stage || stage.kind !== kind || stage.active || stage.next !== stage.slots.length)
      throw new NativeContextContractError('Native context traversal ended without every original callback observation');
    this.#handlers += stage.next;
    this.#kinds.push(kind);
    this.#stage = undefined;
  }

  /**
   Publish a terminal receipt only after both original context traversals have completed.

   @returns immutable traversal receipt for the original run owner

   @throws NativeContextContractError when the emitter is pending, incomplete, or reused
   */
  complete(): NativeContextCompletion {
    tagged({tag:this.complete.name,l}).debug('publishing original context completion');
    if (this.#completed || this.#stage || this.#kinds.length !== 2)
      throw new NativeContextContractError('Native context emission has no complete original traversal');
    this.#completed = true;
    return Object.freeze({kinds:Object.freeze([...this.#kinds]),handlers:this.#handlers});
  }

  /**
   Capture settled input before advancing the owned callback position.

   @param stage - current stage with its original active event

   @throws NativeContextContractError when settlement loses its original input
   */
  #settle(stage: NativeContextStage): void {
    const active = stage.active;
    if (!active) throw new NativeContextContractError('Native context settlement has no original input');
    this.#record({stage,phase:'after',value:active.event});
    stage.active = undefined;
    stage.next++;
  }

  /**
   Route complete values to the captured manager pool without exposing its capture capability.

   @param stage - current native callback position

   @param phase - original boundary at which the value was observed

   @param value - original input or result before any native field selection

   @throws NativeContextCaptureFailure when the original manager capture throws
   */
  #record({stage,phase,value}: {
    readonly stage: NativeContextStage;
    readonly phase: NativeContextInput['phase'];
    readonly value: unknown;
  }): void {
    const active = stage.active;
    if (!active) throw new NativeContextContractError('Native context capture has no original callback');
    try {
      this.#capture({kind:stage.kind,phase,ordinal:stage.next,path:active.slot.path,value});
    } catch (error) {
      throw new NativeContextCaptureFailure(error);
    }
  }
}

//endregion One observer owns one complete native context emission
