import { ProducerInputRunError, } from './producer-input-error.ts';

//region Scoped host interruption ownership

/**
 Only parent interruption signals belong to this CLI's cancellation state.
 */
type InputSignal = 'SIGINT' | 'SIGTERM';
/**
 Scoped interruption exists only for the specialized input CLI invocation.
 */
export type ProducerInputSignals = Disposable & {
  /**
   Parent interruption is forwarded to the active native stage.
   */
  readonly signal: AbortSignal;
};

/**
 A retained complete output is not reported as an uninterrupted host success.
 */
export class ProducerInputInterruptedError extends Error {
  /**
   Only fixed signal vocabulary enters this message.
   */
  readonly messageNamesOnly: true = true;
  /**
   Native shell convention is selected without collapsing both signals to one refusal code.
   */
  readonly signal: InputSignal;
  /**
   @param signal - captured parent interruption
   
   @example
   ```ts
   throw new ProducerInputInterruptedError('SIGINT');
   ```
   */
  constructor(signal: InputSignal) {
    super(`Preparation input run was interrupted by ${signal}. Retained files remain available for independent review; do not resume or overwrite this run automatically.`);
    this.name = 'ProducerInputInterruptedError';
    this.signal = signal;
  }
}

/**
 Refuses late cancellation even when the child produced complete usable files.
 
 @param signal - host-owned interruption signal, never a command deadline
 
 @throws ProducerInputInterruptedError when the host was interrupted
 
 @example
 ```ts
 assertProducerInputNotInterrupted(signal);
 ```
 */
export function assertProducerInputNotInterrupted(signal: AbortSignal): void {
  if (!signal.aborted)
    return;
  /**
   Native AbortSignal reasons remain unknown until matched to the closed signal vocabulary.
   */
  const reason: unknown = signal.reason;
  if ((reason !== 'SIGINT') && (reason !== 'SIGTERM'))
    throw new ProducerInputRunError({
      operation: 'launch-container',
      locator: 'host interruption reason',
    });
  throw new ProducerInputInterruptedError(reason);
}

/**
 Captures one interruption for cleanup; a repeated signal restores native forced termination behavior.
 
 @returns Scoped cancellation and listener disposal
 
 @example
 ```ts
 using signals = producerInputSignals();
 await runProducerInputHost(input);
 ```
 */
export function producerInputSignals(): ProducerInputSignals {
  /**
   One host invocation owns its abort state.
   */
  const controller = new AbortController();
  /**
   Exact installed listeners can be removed without referring to undeclared functions.
   */
  const listeners = new Map<InputSignal, () => void>();
  /**
   Repeated interruption is not silently swallowed while native cleanup is pending.
   
   @param signal - exact installed native signal, never an arbitrary abort reason
   */
  function receive(signal: InputSignal): void {
    if (controller.signal
      .aborted) {
      for (const [name, listener] of listeners)
        process.off(
          name,
          listener
        );
      process.kill(
        process.pid,
        signal
      );
      return;
    }
    controller.abort(signal);
  }
  /**
   Keyboard interruption keeps its original signal identity.
   */
  function interrupted(): void {
    receive('SIGINT');
  }
  /**
   External termination still permits one bounded cleanup attempt.
   */
  function terminated(): void {
    receive('SIGTERM');
  }
  listeners.set(
    'SIGINT',
    interrupted
  );
  listeners.set(
    'SIGTERM',
    terminated
  );
  for (const [name, listener] of listeners)
    process.on(
      name,
      listener
    );
  return {
    signal: controller.signal,
    [Symbol.dispose](): void {
      for (const [name, listener] of listeners)
        process.off(
          name,
          listener
        );
    },
  };
}

//endregion Scoped host interruption ownership
