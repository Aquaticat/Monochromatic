/**
 Disposable native-slot double for hook lifecycle controls.

 @module
 */
import type {
  installNativePolicyHooks,
  NativePolicyAgentSlots,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/**
 Installer options remain the maintained package's actual contract.
 */
type HookOptions = Parameters<typeof installNativePolicyHooks>[0];

/**
 Mutable test controls are owned by each fixture, never shared agent state.
 */
export type NativeHookFixture = {
  /**
   Borrowed native-slot double.
   */
  readonly agent: NativePolicyAgentSlots;
  /**
   Exact registration, cleanup and reader order.
   */
  readonly events: string[];
  /**
   Explicit native lifetime conditions controlled by the test.
   */
  readonly controls: {
    disposed: boolean;
    active: boolean
  };
  /**
   Original callbacks and values supplied to the maintained installer.
   */
  readonly options: HookOptions;
};

/**
 Construct isolated mutable capabilities without granting any native ownership claim.

 @returns fresh slots and callback controls for one test

 @example
 ```ts
 const fixture = createNativeHookFixture();
 fixture.controls.disposed = true;
 ```
 */
export function createNativeHookFixture(): NativeHookFixture {
  /**
   No callback records are shared between concurrently dispatched tests.
   */
  const events: string[] = [];
  /**
   These booleans represent actual fixture lifetime conditions.
   */
  const controls = {
    disposed: false,
    active: false,
  };
  /**
   Original provider callable records unexpected invocation during installation.
   */
  function previousStream(): void {
    events.push('called-original-stream',);
  }
  /**
   Guarded provider callable records unexpected invocation during installation.
   */
  function observedStream(): void {
    events.push('called-observed-stream',);
  }
  /**
   Complete-group executor records unexpected execution during installation.
   */
  function executeToolBatch(): void {
    events.push('called-executor',);
  }
  /**
   Native active-run signal remains a capability rather than a truthy flag.
   */
  const controller = new AbortController();
  /**
   Getter shape mirrors the native active-run slot without inspecting its signal.
   */
  const agent: NativePolicyAgentSlots = {
    /**
     Record whether disposal checking reads native active-run state.
     */
    get signal(): unknown {
      events.push('signal',);
      return controls.active ? controller.signal : undefined;
    },
    streamFunction: previousStream,
    executeToolBatch: undefined,
  };
  /**
   Each registration returns its original remover.
   */
  const options: HookOptions = {
    agent,
    previousStream,
    observedStream,
    executeToolBatch,
    invalidateObserver(): void { events.push('invalidate',); },
    registerExecutionTools() {
      events.push('register-tools',);
      return function removeTools(): void {
        events.push('remove-tools',);
      };
    },
    isSessionDisposed(): boolean {
      events.push('disposed',);
      return controls.disposed;
    },
    onDetached(): void { events.push('detached',); },
  };
  return {
    agent,
    events,
    controls,
    options,
  };
}
