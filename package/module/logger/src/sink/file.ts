import { openFileDestination, } from './file-destination.ts';

import { reportLoggerInternalError, } from '../error-format.ts';

import type { Sink, } from '../types.ts';
import { createFileAppendQueue, } from './file-append.ts';

/**
 Object serialization completed without producing a JSON value suitable for a JSONL record.
 */
class FileRecordSerializationError extends Error {
  /**
   Identify the serializer boundary without retaining the rejected object.
   */
  constructor() {
    super('File sink record serialization produced no JSON value',);
    this.name = 'FileRecordSerializationError';
  }
}



//region File sink
// Append-only JSONL sink. Imports `node:fs/promises` statically: this module
// is reachable only from the Node artifact (the `./node` subpath and the
// `#default-sinks` `node` condition), so the `node` export condition already
// asserts a Node runtime and no `process.versions.node` probe is needed.

/**
 Builds a file sink that appends JSONL records to a caller-selected directory,
 `MONOCHROMATIC_LOG_DIRECTORY`, or the nearest ancestor
 `node_modules/.monochromatic/{timestamp}.log.jsonl`, with user-state fallback (resolved once during
 verification). The resolved path and the verification memo live in this
 instance's closure (no module-global state), so independent loggers and
 tests retain their own append ordering. Each `write` returns its batch's
 complete append, so the logger's pending-write tracking also
 covers queued records without a separate `flush` hook.
 
 @param directory - explicit destination keeps caller-owned diagnostics outside workspace artifacts

 @returns Sink backed by `node:fs/promises`.
 
 @example
 ```ts
 const { logger } = createLogger({ sinks: [createFileSink()] });
 logger.error('unhandled rejection');
 await logger.flush();
 ```
 */
export function createFileSink({
  directory = process.env
    .MONOCHROMATIC_LOG_DIRECTORY,
}: Readonly<{ directory?: string }> = {}): Sink {
  /**
   Empty destinations preserve ancestor discovery; other supplied paths remain literal.
   */
  const explicitDirectory = directory === '' ? undefined : directory;
  /**
   Instance-local file-sink resources. `appends` is populated during
   verification and read by `write`; `verifyPromise` memoizes concurrent
   verification so a caller arriving mid-flight shares the same async work
   rather than starting a second probe.
   */
  const state: {
    appends?: ReturnType<typeof createFileAppendQueue>;
    verifyPromise?: Promise<boolean>;
  } = {};
  /**
   Unverified writes keep their existing fulfilled completion without allocating per discarded record.
   */
  const completedWrite = Promise.resolve();

  /**
   Actual verification work, invoked exactly once via the memoized
   `verifyPromise`. Resolves the log path, falling back from an unavailable project to user state.
   Explicit destinations remain strict. The logger owns resulting availability.
   
   @returns Whether file system logging is available.
   */
  async function runVerify(): Promise<boolean> {
    try {
      const filePath = await openFileDestination({ directory: explicitDirectory, });
      state.appends = createFileAppendQueue({ filePath, },);
      return true;
    }
    catch (error: unknown) {
      reportLoggerInternalError({
        context: 'file sink verification failed',
        error,
      },);
      return false;
    }
  }

  /**
   Verifies file system availability via {@link runVerify}, memoizing
   concurrent calls so a second caller never starts a duplicate probe.
   
   @returns Whether file system logging is available.
   */
  function verify(): Promise<boolean> {
    if (state.verifyPromise
      !== undefined)
      return state.verifyPromise;

    state.verifyPromise = runVerify();
    return state.verifyPromise;
  }

  /**
   Writes a single record as a JSONL line to the resolved log file.
   
   @param record - Log record to write.
   
   @mutates record - `JSON.stringify` may invoke `toJSON`, getters, or proxy traps.
   */
  function write(record: object,): Promise<void> {
    /**
     Append owner resolved during verification; unverified writes retain their existing no-op behavior.
     */
    const { appends, } = state;
    if (appends === undefined)
      return completedWrite;

    try {
      /**
       Serialization finishes before queue admission, including reentrant writes from user serialization hooks.
       */
      const serialized = JSON.stringify(record,);
      if (serialized === undefined)
        throw new FileRecordSerializationError();
      return appends.append(`${serialized}\n`,);
    }
    catch (error: unknown) {
      reportLoggerInternalError({
        context: 'file sink record append failed',
        error,
      },);
      return completedWrite;
    }
  }

  return {
    verify,
    write,
  };
}
//endregion File sink
