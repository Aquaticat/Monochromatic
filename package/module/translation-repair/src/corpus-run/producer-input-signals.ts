//region Scoped host interruption ownership

/** Scoped interruption exists only for the specialized input CLI invocation. */
export type ProducerInputSignals = Disposable & {
  /** Parent interruption is forwarded to the active native stage. */
  readonly signal: AbortSignal;
};

/**
 * Captures host interruption without exiting before retained terminal evidence can be written.
 * Cleanup uses its own uncancelled signal and the process listeners are always removed on scope exit.
 *
 * @returns Scoped cancellation and listener disposal
 *
 * @example
 * ```ts
 * using signals = producerInputSignals();
 * await runProducerInputHost({ signal: signals.signal, ...input });
 * ```
 */
export function producerInputSignals(): ProducerInputSignals {
  /** One host invocation owns its abort state. */
  const controller = new AbortController();
  /** Keyboard interruption is distinguished from external termination in native stage evidence. */
  function interrupted(): void {
    controller.abort('SIGINT');
  }
  /** Termination still allows the host to settle its owned container and private records. */
  function terminated(): void {
    controller.abort('SIGTERM');
  }
  process.on('SIGINT', interrupted);
  process.on('SIGTERM', terminated);
  return {
    signal: controller.signal,
    [Symbol.dispose](): void {
      process.off('SIGINT', interrupted);
      process.off('SIGTERM', terminated);
    },
  };
}

//endregion Scoped host interruption ownership
