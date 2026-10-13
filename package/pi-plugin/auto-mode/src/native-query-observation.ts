/**
 Failure retention shared by native loadout query input and output observation.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region Observation callbacks remain owned by the native integration

/**
 Synchronous receiver selected by the native owner, not supplied by query arguments.
 */
export type NativeQueryCapture = (frame: unknown,) => undefined;

/**
 Failure operations do not authenticate frames, establish coverage, or authorize execution.
 */
export type NativeQueryObservation = {
  /**
   Forward original input frame before native lookup starts.
   */
  readonly captureInput: (frame: unknown,) => void;
  /**
   Forward original output frame after native lookup succeeds.
   */
  readonly captureOutput: (frame: unknown,) => void;
  /**
   Prevent a caught observer failure from permitting later native consumption.
   */
  readonly assertHealthy: () => void;
  /**
   Retain independent failures when native error reporting also throws.
   */
  readonly reportFailed: (input: {
    /**
     Native callback failure delivered to its original reporter.
     */
    readonly nativeError: unknown;
    /**
     Failure from that reporter, including falsy thrown values.
     */
    readonly reportError: unknown;
  },) => never;
};

/**
 Logger contains lifecycle labels only, never borrowed query values or thrown objects.
 */
const l = tagged({ tag: 'auto-mode-native-query-observation', },);

/**
 Keep the first unexpected observation failure independently of native callback handling.
 The integration supplies synchronous capture receivers and authenticates original frames.
 Expected profile refusals remain the capture owner's responsibility.
 A fresh successful capture cannot revive this observation lifetime after failure.
 Only the returned method container is frozen; callbacks and frames remain borrowed.

 @param captureInput - fixed native input receiver

 @param captureOutput - fixed native output receiver

 @returns observation lifetime without source authority or execution permission

 @example
 ```ts
 const observation = createNativeQueryObservation({
   captureInput: frame => { retainInput(frame); },
   captureOutput: frame => { retainOutput(frame); },
 });
 observation.captureInput(originalFrame);
 observation.assertHealthy();
 ```
 */
export function createNativeQueryObservation(
  {
    captureInput: inputReceiver,
    captureOutput: outputReceiver,
  }: {
    readonly captureInput: NativeQueryCapture;
    readonly captureOutput: NativeQueryCapture;
  },
): NativeQueryObservation {
  /**
   Attribute this lifetime without inspecting any caller-owned material.
   */
  const rl = tagged({
    tag: createNativeQueryObservation.name,
    l,
  },);
  rl.debug('creating native query observation lifetime',);
  /**
   Owned state acquires a failure field even when the thrown value is undefined.
   */
  const state: { failure?: { readonly error: unknown; }; } = {};

  /**
   Retain the original input failure before the native query may begin.

   @param frame - opaque original frame validated by the fixed input receiver

   @throws original receiver failure without replacing its value
   */
  function captureInput(frame: unknown,): void {
    /**
     Keep input entry diagnostics separate from output processing.
     */
    const il = tagged({
      tag: captureInput.name,
      l: rl,
    },);
    il.debug('observing native query input',);
    try {
      inputReceiver(frame,);
    }
    catch (error) {
      state.failure ??= { error, };
      throw error;
    }
  }

  /**
   Retain the original output failure without reading or replacing the query result.

   @param frame - opaque original frame validated by the fixed output receiver

   @throws original receiver failure without replacing its value
   */
  function captureOutput(frame: unknown,): void {
    /**
     Output processing retains its own diagnostic boundary.
     */
    const ol = tagged({
      tag: captureOutput.name,
      l: rl,
    },);
    ol.debug('observing native query output',);
    try {
      outputReceiver(frame,);
    }
    catch (error) {
      state.failure ??= { error, };
      throw error;
    }
  }

  /**
   Refuse continuation after a callback caught an unexpected observer failure.

   @throws first original receiver failure, including undefined
   */
  function assertHealthy(): void {
    /**
     No query values or failure objects are formatted by the logger.
     */
    const al = tagged({
      tag: assertHealthy.name,
      l: rl,
    },);
    al.debug('checking native query observation lifetime',);
    if (state.failure !== undefined)
      throw state.failure
        .error;
  }

  /**
   Preserve native reporting behavior and any independent observation failure.

   @param nativeError - original callback failure supplied to native reporting

   @param reportError - original reporter failure

   @throws AggregateError retaining every failure when observation also failed

   @throws original reporter failure when no observation failure occurred
   */
  function reportFailed(
    {
      nativeError,
      reportError,
    }: {
      readonly nativeError: unknown;
      readonly reportError: unknown;
    },
  ): never {
    /**
     Reporting diagnostics never format untrusted thrown values.
     */
    const el = tagged({
      tag: reportFailed.name,
      l: rl,
    },);
    el.debug('retaining native query error-reporting failure',);
    if (state.failure !== undefined) {
      throw new AggregateError(
        [
          state.failure
            .error,
          nativeError,
          reportError,
        ],
        'Original loadout query observation and native error reporting did not complete',
      );
    }
    throw reportError;
  }

  return Object.freeze({
    captureInput,
    captureOutput,
    assertHealthy,
    reportFailed,
  },);
}

//endregion Original observation failure retention
