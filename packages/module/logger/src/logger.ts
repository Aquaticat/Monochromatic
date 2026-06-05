import {
  consoleSink,
  verifyConsole,
} from './sinks/console.ts';
import {
  fileSink,
  verifyFile,
} from './sinks/file.ts';
import {
  opfsSink,
  verifyOpfs,
} from './sinks/opfs.ts';
import {
  sessionStorageSink,
  verifySessionStorage,
} from './sinks/session-storage.ts';
import type {
  Level,
  Logger,
  LogRecord,
  Sink,
  Verify,
} from './types.ts';

/**
 * Represents a sink with its verification status.
 */
type SinkEntry = {
  available: boolean;
  sink: Sink;
  verify: Verify;
};

/**
 * All sink backends to attempt, in priority order. Each entry starts
 * `available: false` (not-yet-verified reads as unavailable, identical to
 * a verified failure) and flips true once its `verify` confirms the
 * backend; a tri-state with a `null` "pending" value would add no
 * behaviour the `=== true` filters do not already give.
 */
const sinkEntries: SinkEntry[] = [
  {
    available: false,
    sink: consoleSink,
    verify: verifyConsole,
  },
  {
    available: false,
    sink: opfsSink,
    verify: verifyOpfs,
  },
  {
    available: false,
    sink: sessionStorageSink,
    verify: verifySessionStorage,
  },
  {
    available: false,
    sink: fileSink,
    verify: verifyFile,
  },
];

/**
 * Sink entry paired with its stable startup-order index.
 */
type IndexedSinkEntry = {
  readonly entry: SinkEntry;
  readonly entryIndex: number;
};

/**
 * Sentinel returned by {@link verifyEntry} when verification completed
 * synchronously. A unique symbol avoids `void` as an optional-return escape.
 */
const SYNC_VERIFICATION_DONE = Symbol('logger:sync-verification-done',);

/**
 * Log records emitted before every sink has completed startup verification.
 * Records stay here only during initialization; each sink that later verifies
 * as available receives a replay, while already-available sinks still receive
 * writes immediately.
 */
const startupRecords: LogRecord[] = [];

/**
 * Sink writes currently in flight. Logger-level `flush()` drains these so
 * sinks without their own flush hook, such as file writes, still settle before
 * the flush resolves.
 */
const pendingWrites = new Set<Promise<void>>();

/**
 * Module-local mutable state grouped in a `const` container so module-root
 * state stays out of a top-level `let` (`no-module-root-let` would otherwise
 * reject it). `initialized` flips true once the eager `initialize()` settles;
 * `hasAvailableSink` reflects whether any sink survives verification and is
 * recomputed by `recomputeAvailability` as sinks drop out at runtime.
 */
const state: {
  initialized: boolean;
  hasAvailableSink: boolean;
} = {
  hasAvailableSink: false,
  initialized: false,
};

/**
 * Recomputes global availability after a sink entry's `available` flag flips.
 * Call sites mutate the failing entry's flag directly (the entry is a callback
 * parameter, so a `readonly` parameter type cannot forbid the assignment), then
 * invoke this to recalculate the aggregate.
 */
function recomputeAvailability(): void {
  state.hasAvailableSink = sinkEntries.some(function isAvailable(sinkEntry,) {
    return sinkEntry.available;
  },);
}

/**
 * Reads a sink entry by startup-order index.
 *
 * @param entryIndex - Sink entry index from {@link sinkEntries}.
 *
 * @returns Sink entry at that index.
 *
 * @throws Error when index no longer maps to a sink entry.
 */
function getSinkEntry({ entryIndex, }: { readonly entryIndex: number; },): SinkEntry {
  /**
   * Sink entry read from startup-order storage; undefined means the caller supplied an invalid index.
   */
  const entry = sinkEntries[entryIndex];
  if (entry === undefined)
    throw new Error(`Missing logger sink entry at index ${entryIndex}.`,);

  return entry;
}

/**
 * Marks a sink unavailable after verification or write failure.
 *
 * @param entryIndex - Sink entry index whose backend can no longer receive records.
 */
function markEntryUnavailable({ entryIndex, }: { readonly entryIndex: number; },): void {
  /**
   * Mutable sink entry being disabled.
   */
  const entry = getSinkEntry({ entryIndex, },);
  entry.available = false;
  recomputeAvailability();
}

/**
 * Tracks one sink write and disables the sink if the asynchronous write rejects.
 *
 * @param entryIndex - Sink entry index receiving the record.
 *
 * @param writePromise - Promise returned by the sink write call.
 */
async function trackWrite(
  {
    entryIndex,
    writePromise,
  }: {
    readonly entryIndex: number;
    readonly writePromise: Promise<void>;
  },
): Promise<void> {
  try {
    await writePromise;
  }
  catch {
    markEntryUnavailable({ entryIndex, },);
  }
}

/**
 * Removes a tracked sink write from {@link pendingWrites} once monitoring ends.
 *
 * @param trackedWrite - Promise returned by {@link trackWrite}.
 */
async function removePendingWriteWhenSettled(
  { trackedWrite, }: { readonly trackedWrite: Promise<void>; },
): Promise<void> {
  await trackedWrite;
  pendingWrites.delete(trackedWrite,);
}

/**
 * Sends a record to one sink, recording the write so `flush()` can await it.
 *
 * @param entryIndex - Available sink entry index to receive the record.
 *
 * @param record - Log record to deliver.
 */
function writeRecordToEntry(
  {
    entryIndex,
    record,
  }: {
    readonly entryIndex: number;
    readonly record: LogRecord;
  },
): void {
  try {
    /**
     * Sink entry receiving the record.
     */
    const entry = getSinkEntry({ entryIndex, },);
    /**
     * Monitored sink write; resolves even when the sink write rejects because
     * rejection handling marks the sink unavailable instead of crashing callers.
     */
    const trackedWrite = trackWrite({
      entryIndex,
      writePromise: entry.sink
        .write(record,),
    },);
    pendingWrites.add(trackedWrite,);
    void removePendingWriteWhenSettled({ trackedWrite, },);
  }
  catch {
    markEntryUnavailable({ entryIndex, },);
  }
}

/**
 * Replays startup records to a sink that just became available.
 *
 * @param entryIndex - Newly available sink entry index.
 */
function replayStartupRecordsToEntry({ entryIndex, }: { readonly entryIndex: number; },): void {
  startupRecords.forEach(function replayStartupRecord(record,) {
    writeRecordToEntry({
      entryIndex,
      record,
    },);
  },);
}

/**
 * Applies verification result to a sink and replays startup records on success.
 *
 * @param entryIndex - Sink entry index whose verification completed.
 *
 * @param available - Whether backend verified successfully.
 */
function setEntryAvailability(
  {
    entryIndex,
    available,
  }: {
    readonly entryIndex: number;
    readonly available: boolean;
  },
): void {
  /**
   * Sink entry whose availability is changing.
   */
  const entry = getSinkEntry({ entryIndex, },);
  entry.available = available;
  recomputeAvailability();
  if (available)
    replayStartupRecordsToEntry({ entryIndex, },);
}

/**
 * Awaits an asynchronous sink verification and records its availability.
 *
 * @param entryIndex - Sink entry index being verified.
 *
 * @param verification - Async verification result to await.
 */
async function resolveAsyncVerification(
  {
    entryIndex,
    verification,
  }: {
    readonly entryIndex: number;
    readonly verification: Promise<boolean>;
  },
): Promise<void> {
  try {
    setEntryAvailability({
      available: await verification,
      entryIndex,
    },);
  }
  catch {
    markEntryUnavailable({ entryIndex, },);
  }
}

/**
 * Starts verification for a sink, preserving synchronous availability for
 * sync verifiers such as the console sink.
 *
 * @param entryIndex - Sink entry index to verify.
 *
 * @returns Promise for async verification, or {@link SYNC_VERIFICATION_DONE}.
 */
function verifyEntry(
  { entryIndex, }: { readonly entryIndex: number; },
): Promise<void> | typeof SYNC_VERIFICATION_DONE {
  try {
    /**
     * Sink entry whose verifier is about to run.
     */
    const entry = getSinkEntry({ entryIndex, },);
    /**
     * Verification return value (sync boolean or Promise); sync results are
     * applied in the same call stack so console logging is available at import.
     */
    const verification = entry.verify();
    if (verification instanceof Promise)
      return resolveAsyncVerification({
        entryIndex,
        verification,
      },);

    setEntryAvailability({
      available: verification,
      entryIndex,
    },);
  }
  catch {
    markEntryUnavailable({ entryIndex, },);
  }

  return SYNC_VERIFICATION_DONE;
}

/**
 * Initializes all sink backends by verifying their availability.
 * Runs once at module load time. Log records emitted during asynchronous
 * verification stay buffered and are replayed to each sink as soon as that
 * sink verifies, so consumers never need to await startup before logging.
 */
async function initialize(): Promise<void> {
  if (state.initialized)
    return;

  for (const [entryIndex,] of sinkEntries.entries()) {
    /**
     * Optional async verification; sync verifiers have already completed by
     * the time `verifyEntry` returns.
     */
    const verification = verifyEntry({ entryIndex, },);
    if (verification !== SYNC_VERIFICATION_DONE)
      // oxlint-disable-next-line no-await-in-loop -- Preserve startup backend priority.
      await verification;
  }

  state.initialized = true;
  startupRecords.length = 0;
}

/**
 * Eager readiness promise. Consumers do not need to await this before logging;
 * `flush()` awaits it internally, and startup records replay to async sinks as
 * they become available.
 */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- Keep logging non-blocking at import.
const initPromise: Promise<void> = initialize();

/**
 * Drains every currently tracked sink write.
 */
async function drainPendingWrites(): Promise<void> {
  /**
   * Snapshot of tracked writes at flush time.
   */
  const writes = [...pendingWrites,];
  await Promise.all(writes,);
}

/**
 * Creates a logging method for the specified severity level.
 *
 * @param level - Log severity level for messages from this method
 *
 * @returns logging function for the given level
 */
function createMethod(level: Level,): (message: string,) => void {
  return function logAtLevel(message: string,): void {
    if ((!state.hasAvailableSink) && state
      .initialized)
      throw new Error('No logging backends available',);

    /**
     * Shared LogRecord forwarded to every available sink; built once per call so all sinks see the same timestamp.
     */
    const record: LogRecord = {
      level,
      message,
      timestamp: Date.now(),
    };

    if (!state.initialized)
      startupRecords.push(record,);

    /**
     * Subset of sinks that survived verification; filtered fresh per call so a
     * sink that drops out is excluded next time.
     */
    const availableEntries = sinkEntries
      .map(function indexSinkEntry(
        entry,
        entryIndex,
      ): IndexedSinkEntry {
        return {
          entry,
          entryIndex,
        };
      },)
      .filter(function isAvailable(indexedEntry,) {
        return indexedEntry.entry
          .available;
      },);
    if (availableEntries.length
      === 0)
      return;

    availableEntries.forEach(function writeToSink({ entryIndex, },) {
      writeRecordToEntry({
        entryIndex,
        record,
      },);
    },);

    if (!state.hasAvailableSink)
      throw new Error('All logging backends have failed',);
  };
}

/**
 * Drains startup verification, in-flight sink writes, and buffered records in
 * every available sink that exposes its own `flush` hook. Resolves once all
 * tracked writes and hooks have settled. Per-sink failures are isolated: a
 * rejecting write or `flush` marks that sink unavailable and does not fail the
 * aggregate.
 *
 * Safe to call when no sink buffers; resolves immediately after startup and
 * pending writes settle.
 *
 * @example
 * ```ts
 * l.error('crash');
 * await l.flush(); // ensures the error is visible before the next step
 * ```
 */
async function flushAll(): Promise<void> {
  await initPromise;
  await drainPendingWrites();
  await Promise.all(
    sinkEntries.map(async function runFlush(
      entry,
      entryIndex,
    ) {
      /**
       * Optional sink-supplied flush hook; absent when the sink writes synchronously and needs no draining.
       */
      const sinkFlush = entry.sink
        .flush;
      if ((!entry.available) || ((typeof sinkFlush) !== 'function'))
        return;
      try {
        await sinkFlush();
      }
      catch {
        markEntryUnavailable({ entryIndex, },);
      }
    },),
  );
}

/**
 * Multi-sink logger that writes to all available backends.
 * Startup records replay to async sinks that verify after the log call;
 * log calls throw only after initialization proves no backend is available
 * or every backend has failed.
 */
export const logger: Logger = {
  debug: createMethod('debug',),
  error: createMethod('error',),
  fatal: createMethod('fatal',),
  flush: flushAll,
  info: createMethod('info',),
  trace: createMethod('trace',),
  warn: createMethod('warn',),
};

export { initPromise, };
