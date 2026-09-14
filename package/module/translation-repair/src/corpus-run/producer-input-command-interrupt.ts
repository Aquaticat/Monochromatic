import type { ChildProcess, } from 'node:child_process';
import {
  clearTimeout,
  setTimeout,
} from 'node:timers';
import { PRODUCER_INPUT_COMMAND_TIMES, } from './producer-input-bounds.ts';

/**
 Owns interruption listeners and escalation timers for one native command.
 
 @param child - live process fields, not copied termination snapshots
 
 @param signal - combined command deadline and caller interruption
 
 @returns Listener/timer disposal without altering native close observation
 
 @example
 ```ts
 using interruption = interruptProducerInputCommand({ child, signal });
 ```
 */
export function interruptProducerInputCommand({
  child,
  signal,
}: {
  readonly child: Readonly<Pick<ChildProcess, 'exitCode' | 'signalCode' | 'kill'>>;
  readonly signal: AbortSignal;
}): Disposable {
  /**
   Every pending escalation belongs to this command scope.
   */
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /**
   A native client ignoring SIGTERM does not retain the command indefinitely.
   */
  function forceTermination(): void {
    if ((child.exitCode === null) && (child.signalCode === null))
      child.kill('SIGKILL');
  }
  /**
   Preserve the native forwarding opportunity before bounded forced termination.
   */
  function interrupt(): void {
    child.kill('SIGTERM');
    timers.add(setTimeout(
      forceTermination,
      PRODUCER_INPUT_COMMAND_TIMES.terminationGraceMilliseconds
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
