import type { ChildProcess, } from 'node:child_process';

//region Native process errors do not end close observation

/**
 * Fixed event categories avoid retaining native error messages or input paths.
 */
type NativeInputError = 'error-object' | 'other-error-event';

/**
 * Observes actual native close even when an error event occurs first.
 * Unlike events.once(child, 'close'), an error does not detach this close listener.
 *
 * @param child - newly spawned native process before its asynchronous events can run
 *
 * @returns Owned error categories only after close has been observed
 *
 * @example
 * ```ts
 * const errors = await producerInputCommandClose(child);
 * ```
 */
export function producerInputCommandClose(child: Readonly<Pick<ChildProcess, 'on' | 'off' | 'once'>>): Promise<readonly NativeInputError[]> {
  /**
   * One process owns its event categories until close, without storing native messages.
   */
  const errors = new Set<NativeInputError>();
  /**
   * Close, not the earlier error event, is the sole resolution boundary.
   */
  const {
    promise,
    resolve,
  } = Promise.withResolvers<readonly NativeInputError[]>();
  /**
   * Native errors remain failure evidence while close observation stays installed.
   */
  function failed(error: unknown): void {
    errors.add(Error.isError(error,) ? 'error-object' : 'other-error-event');
  }
  /**
   * No native listener or mutable observation escapes the terminated process.
   */
  function closed(): void {
    child.off(
      'error',
      failed
    );
    resolve([...errors]);
  }
  child.on(
    'error',
    failed
  );
  child.once(
    'close',
    closed
  );
  return promise;
}

//endregion Native process errors do not end close observation
