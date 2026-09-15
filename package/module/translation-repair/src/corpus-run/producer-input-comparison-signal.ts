import { addAbortListener, } from 'node:events';
import { isProxy, } from 'node:util/types';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';

//region Native live cancellation is observed through one owned subscription

/**
 Native accessor descriptor preserves its receiver requirement instead of extracting an unbound method.
 */
const NATIVE_ABORTED = nonNullishOrThrow(
  Object.getOwnPropertyDescriptor(
    AbortSignal.prototype,
    'aborted'
  )
);
/**
 Native method descriptors are retained before caller code can replace public methods.
 */
const NATIVE_EVENT_METHODS = Object.getOwnPropertyDescriptors(EventTarget.prototype);
/**
 Owned controllers use the native constructor captured at module initialization.
 */
const NativeAbortController = AbortController;
/**
 Native abort invocation retains an explicit controller receiver and never takes a caller reason.
 */
const NATIVE_CONTROLLER_METHODS = Object.getOwnPropertyDescriptors(AbortController.prototype);

/**
 Scoped native signal observation for one comparison, not a general execution interface.

 @example
 ```ts
 using cancellation = ownProducerInputComparisonSignal(signal);
 cancellation.assertReadable({});
 ```
 */
export type ProducerInputComparisonCancellation = Disposable & {
  /**
   Only this owned native signal may cross into execution helpers.
   */
  readonly signal: AbortSignal;
  /**
   Event-time observation failures are refused at the awaiting owner, never thrown from dispatch.
   */
  readonly assertReadable: (input: { readonly directory?: string }) => void;
};

/**
 Detaches live cancellation from caller accessors without copying its reason or replacing caller properties.
 Registration preserves Node's propagation-resistance options but is persistent until explicit disposal:
 synthetic events must not consume observation of a later native abort.

 @param source - genuine same-realm signal whose native state and subscription remain borrowed here only

 @returns Owned native signal and scoped subscription with a names-only observation check

 @throws ProducerInputComparisonError when native signal setup or observation cannot be verified

 @example
 ```ts
 using cancellation = ownProducerInputComparisonSignal(request.signal);
 cancellation.assertReadable({});
 ```
 */
export function ownProducerInputComparisonSignal(source: AbortSignal): ProducerInputComparisonCancellation {
  /**
   Live downstream state contains no caller-supplied reason or property implementation.
   */
  const controller = new NativeAbortController();
  /**
   Subscription lifecycle and unreadable-state evidence stay local to this invocation.
   */
  const state: {
    unreadable: boolean;
    released: boolean;
    attempted: boolean;
    subscription?: Disposable;
  } = {
    unreadable: false,
    released: false,
    attempted: false,
  };

  /**
   Reads actual native state rather than an own public getter.

   @returns Native boolean after composite refresh, when supported

   @throws ProducerInputComparisonError when the native result is not boolean

   @example
   ```ts
   const aborted = readNativeState();
   ```
   */
  function readNativeState(): boolean {
    /**
     Native accessor invocation is unknown until its primitive result is checked.
     */
    const aborted: unknown = NATIVE_ABORTED.get?.call(source);
    if ((typeof aborted) !== 'boolean')
      throw new ProducerInputComparisonError({ kind: 'contract' });
    return aborted;
  }

  /**
   Forwards actual cancellation without trusting event identity, caller reasons or thrown metadata.
   A malformed composite observation is retained for the awaiting owner, not emitted from this callback.

   @example
   ```ts
   forwardNativeCancellation();
   ```
   */
  function forwardNativeCancellation(): void {
    try {
      if (readNativeState()) {
        if (NATIVE_CONTROLLER_METHODS.abort.value === undefined)
          throw new ProducerInputComparisonError({ kind: 'contract' });
        NATIVE_CONTROLLER_METHODS.abort.value.call(controller);
      }
    }
    catch (error) {
      // Foreign accessor values never become causes, diagnostic names or operation authority.
      void error;
      state.unreadable = true;
    }
  }

  /**
   Refuses any recorded observation fault using only the owner's optional retained locator.

   @param directory - already-owned comparison directory, absent before namespace creation

   @throws ProducerInputComparisonError when native state or subscription cleanup was unreadable

   @example
   ```ts
   assertReadable({ directory: run.directory });
   ```
   */
  function assertReadable({ directory }: { readonly directory?: string }): void {
    if (state.unreadable)
      throw new ProducerInputComparisonError({
        kind: 'contract',
        ...(directory === undefined ? {} : { directory })
      });
  }

  /**
   Releases exactly this native listener without invoking a caller removal override.
   Partial registration is also removed when Node throws during its listener hook.

   @example
   ```ts
   releaseSubscription();
   ```
   */
  function releaseSubscription(): void {
    if (state.released) return;
    state.released = true;
    if (!state.attempted) return;
    try {
      if (state.subscription !== undefined) state.subscription[Symbol.dispose]();
      else {
        if (NATIVE_EVENT_METHODS.removeEventListener.value === undefined)
          throw new ProducerInputComparisonError({ kind: 'contract' });
        NATIVE_EVENT_METHODS.removeEventListener.value.call(
          source,
          'abort',
          forwardNativeCancellation
        );
      }
    }
    catch (error) {
      // Cleanup cannot replace an existing operation failure with caller-controlled metadata.
      void error;
      state.unreadable = true;
    }
  }

  /**
   Only the source-verified Node registration protocol receives these positional callbacks.
   */
  const nativeMethods = {
    /**
     Preserves opaque Node options while preventing synthetic-event consumption.

     @param type - fixed abort subscription requested by Node's helper

     @param listener - exact owned cancellation callback

     @param options - Node-owned resistance and registration settings

     @throws ProducerInputComparisonError when the registration protocol changes

     @example
     ```ts
     addAbortListener(registrationView, forwardNativeCancellation);
     ```
     */
    addEventListener: function addNativeListener(
      this: void,
      type: string,
      listener: EventListener | EventListenerObject,
      options?: Readonly<AddEventListenerOptions> | boolean
    ): void {
      if ((type !== 'abort') || (listener !== forwardNativeCancellation)
        || ((typeof options) !== 'object') || (options === null)
        || (NATIVE_EVENT_METHODS.addEventListener.value === undefined))
        throw new ProducerInputComparisonError({ kind: 'contract' });
      NATIVE_EVENT_METHODS.addEventListener.value.call(
        source,
        type,
        listener,
        {
          ...options,
          once: false
        }
      );
    },
    /**
     Removes the native listener without looking up caller methods.

     @param type - fixed abort subscription being released

     @param listener - exact owned cancellation callback

     @param options - native matching options preserved by the disposer

     @throws ProducerInputComparisonError when the owned subscription protocol differs

     @example
     ```ts
     subscription[Symbol.dispose]();
     ```
     */
    removeEventListener: function removeNativeListener(
      this: void,
      type: string,
      listener: EventListener | EventListenerObject,
      options?: Readonly<EventListenerOptions> | boolean
    ): void {
      if ((type !== 'abort') || (listener !== forwardNativeCancellation)
        || (NATIVE_EVENT_METHODS.removeEventListener.value === undefined))
        throw new ProducerInputComparisonError({ kind: 'contract' });
      NATIVE_EVENT_METHODS.removeEventListener.value.call(
        source,
        type,
        listener,
        options
      );
    },
  } satisfies Pick<AbortSignal, 'addEventListener' | 'removeEventListener'>;

  try {
    if (isProxy(source) || (Object.getPrototypeOf(source) !== AbortSignal.prototype))
      throw new ProducerInputComparisonError({ kind: 'contract' });
    /**
     Only Node's source-verified registration helper receives this private protocol view.
     */
    const registrationView = new Proxy(
      source,
      { get: function readRegistrationProperty(
        _target: AbortSignal,
        property: string | symbol
      ): unknown {
        if (property === 'aborted') return readNativeState();
        if (property === 'addEventListener') return nativeMethods.addEventListener;
        if (property === 'removeEventListener') return nativeMethods.removeEventListener;
        throw new ProducerInputComparisonError({ kind: 'contract' });
      } }
    );
    if (readNativeState()) forwardNativeCancellation();
    else {
      state.attempted = true;
      state.subscription = addAbortListener(
        registrationView,
        forwardNativeCancellation
      );
      forwardNativeCancellation();
    }
    assertReadable({});
  }
  catch (error) {
    // Caught class identity does not authenticate foreign signal metadata.
    void error;
    releaseSubscription();
    throw new ProducerInputComparisonError({ kind: 'contract' });
  }
  return {
    signal: controller.signal,
    assertReadable,
    [Symbol.dispose]: releaseSubscription
  };
}

//endregion Native live cancellation is observed through one owned subscription
