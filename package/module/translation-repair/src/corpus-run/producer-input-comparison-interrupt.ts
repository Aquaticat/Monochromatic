import type { ChildProcess, } from 'node:child_process';
import {
  clearTimeout,
  setTimeout,
} from 'node:timers';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';

//region Scoped bootstrap interruption is registered before native child creation

/**
 Cooperative cleanup has its own bound before forced host-process termination.
 */
export const BOOTSTRAP_TERMINATION_GRACE_MS = 180_000;
/**
 Native child operations become available only after the actual-close observer is installed.
 */
type BootstrapChild = Readonly<Pick<ChildProcess, 'exitCode' | 'signalCode' | 'kill'>>;
/**
 One fixed bootstrap child is attached to an already registered cancellation scope.

 @example
 ```ts
 interruption.attach(child);
 ```
 */
export type ComparisonBootstrapInterruption = Disposable & {
  /**
   Attaches the spawned child after independent native-close observation is active.
   */
  readonly attach: (child: BootstrapChild) => void;
};

/**
 Registers interruption before spawning so setup failures cannot abandon a newly created child.
 An abort observed before attachment is retained and forwarded once the child and close observer exist.
 No event callback invokes caller logging or reads a borrowed signal.

 @param signal - owned caller cancellation combined with the independent bootstrap deadline

 @param directory - already-owned comparison evidence locator for a setup refusal

 @returns Scoped registration awaiting one actual spawned child

 @throws ProducerInputComparisonError when native registration or attachment cannot be verified

 @example
 ```ts
 using interruption = comparisonBootstrapInterruption({ signal, directory: run.directory });
 const child = spawn(nodePath, args, options);
 const closed = producerInputCommandClose(child);
 interruption.attach(child);
 await closed;
 ```
 */
export function comparisonBootstrapInterruption({
  signal,
  directory,
}: {
  readonly signal: AbortSignal;
  readonly directory: string;
}): ComparisonBootstrapInterruption {
  /**
   All escalation timers belong to this subprocess scope.
   */
  const timers = new Set<ReturnType<typeof setTimeout>>();
  /**
   Cancellation may arrive before native child creation without becoming an unowned signal request.
   */
  const state: { requested: boolean; child?: BootstrapChild } = { requested: false };
  /**
   Enforces the outer process bound without claiming that inner container cleanup finished.

   @example
   ```ts
   forceTermination();
   ```
   */
  function forceTermination(): void {
    /**
     The actual native child is never inferred from a pending cancellation request.
     */
    const child = state.child;
    if (child === undefined) return;
    if ((child.exitCode === null) && (child.signalCode === null)) child.kill('SIGKILL');
  }
  /**
   Retains early interruption and never signals an already closed native child.

   @example
   ```ts
   interrupt();
   ```
   */
  function interrupt(): void {
    state.requested = true;
    /**
     Attachment is separate from registration so no fallible subscription setup follows spawn.
     */
    const child = state.child;
    if (child === undefined) return;
    if ((child.exitCode !== null) || (child.signalCode !== null)) return;
    child.kill('SIGTERM');
    timers.add(setTimeout(
      forceTermination,
      BOOTSTRAP_TERMINATION_GRACE_MS
    ));
  }
  /**
   Binds exactly one owned native child after its independent close observer has been installed.

   @param child - actual spawn result, never a caller-selected process description

   @throws ProducerInputComparisonError when this scope already owns a child

   @example
   ```ts
   interruption.attach(child);
   ```
   */
  function attach(child: BootstrapChild): void {
    if (state.child !== undefined) throw new ProducerInputComparisonError({ kind: 'bootstrap', directory });
    state.child = child;
    if (state.requested) interrupt();
  }
  try {
    signal.addEventListener(
      'abort',
      interrupt,
      { once: true }
    );
    if (signal.aborted) interrupt();
  }
  catch (error) {
    // Setup never forwards native or caller-shaped exception metadata.
    void error;
    signal.removeEventListener('abort', interrupt);
    throw new ProducerInputComparisonError({ kind: 'bootstrap', directory });
  }
  return {
    attach,
    [Symbol.dispose](): void {
      signal.removeEventListener(
        'abort',
        interrupt
      );
      for (const timer of timers) clearTimeout(timer);
    },
  };
}

//endregion Scoped bootstrap interruption is registered before native child creation
