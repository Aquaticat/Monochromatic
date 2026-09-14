import type { ChildProcess, } from 'node:child_process';
import {
  clearTimeout,
  setTimeout,
} from 'node:timers';

//region Scoped native bootstrap interruption without caller logging in event callbacks

/**
 Cooperative cleanup has its own bound before forced host-process termination.
 */
export const BOOTSTRAP_TERMINATION_GRACE_MS = 180_000;
/**
 Removes interruption listeners and timers without treating an error event as native close.
 The grace period bounds this caller, not filesystem durability or successful container cleanup.
 
 @param child - actual spawned bootstrap process, not copied exit fields
 
 @param signal - caller cancellation combined with the independent bootstrap deadline
 
 Logging remains at the awaiting owner so a throwing logger cannot escape an abort-event callback.
 
 @returns Scoped interruption ownership
 
 @example
 ```ts
 using interruption = comparisonBootstrapInterruption({ child, signal });
 ```
 */
export function comparisonBootstrapInterruption({
  child,
  signal,
}: {
  readonly child: Readonly<Pick<ChildProcess, 'exitCode' | 'signalCode' | 'kill'>>;
  readonly signal: AbortSignal;
},): Disposable {
  /**
   All escalation timers belong to this subprocess scope.
   */
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /**
   Enforces the outer process bound without claiming that inner container cleanup finished.
   */
  function forceTermination(): void {
    if ((child.exitCode === null) && (child.signalCode === null)) {
      child.kill('SIGKILL');
    }
  }
  /**
   A closed child is never signalled again, but the caller still observes late cancellation.
   */
  function interrupt(): void {
    if ((child.exitCode !== null) || (child.signalCode !== null))
      return;
    child.kill('SIGTERM');
    timers.add(setTimeout(
      forceTermination,
      BOOTSTRAP_TERMINATION_GRACE_MS
    ));
  }
  signal.addEventListener(
    'abort',
    interrupt,
    { once: true }
  );
  if (signal.aborted)
    interrupt();
  return {
    [Symbol.dispose](): void {
      signal.removeEventListener(
        'abort',
        interrupt
      );
      for (const timer of timers)
        clearTimeout(timer);
    },
  };
}

//endregion Scoped native bootstrap interruption without caller logging in event callbacks
