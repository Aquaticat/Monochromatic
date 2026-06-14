import type {
  Level,
  Logger,
  LogRecord,
  Sink,
} from './types.ts';

/**
 * Sink paired with its current availability inside one logger instance.
 * Availability starts `false` (not-yet-verified reads as unavailable,
 * identical to a verified failure) and flips `true` once the sink's own
 * `verify` confirms its backend.
 */
type SinkEntry = {
  available: boolean;
  readonly sink: Sink;
};

/**
 * Sentinel returned by {@link createLogger}'s `verifyEntry` when verification
 * completed synchronously. A unique symbol avoids `void` as an
 * optional-return escape.
 */
const SYNC_VERIFICATION_DONE = Symbol('logger:sync-verification-done',);

/**
 * Awaits one sink write so `flush()` can observe its settling. A rejected
 * write is swallowed here (the sink owns its own write-error handling) and
 * does not disable the sink: one transient failure must not retire a backend
 * for the rest of the run.
 *
 * @param writePromise - Promise returned by the sink write call.
 */
async function trackWrite(
  { writePromise, }: { readonly writePromise: Promise<void>; },
): Promise<void> {
  try {
    await writePromise;
  }
  catch {
    // Per-sink write failures stay the sink's concern; see above.
  }
}

/**
 * Builds a multi-sink logger over the supplied sink adapters. All
 * orchestration (per-sink availability, startup buffering and replay,
 * in-flight write tracking, and flush) lives here; the exported default
 * `logger` is just this factory applied to the default sink set, and tests
 * apply it to fake sinks to exercise the orchestration directly.
 *
 * Verification runs eagerly at construction and never blocks callers:
 * records emitted while an async sink is still verifying buffer internally
 * and replay to that sink the moment it verifies. A sink whose `verify`
 * resolves `false` or throws is dropped and receives no records. A rejected
 * `write` is the sink's own concern and does not disable the backend.
 *
 * @param sinks - Sink adapters to fan each record out to, in priority order.
 *
 * @returns Logger plus its eager `initPromise`; callers need not await
 * `initPromise` before logging, since startup records replay on verify.
 *
 * @example
 * ```ts
 * const { logger } = createLogger({ sinks: [createConsoleSink()] });
 * logger.info('ready');
 * await logger.flush();
 * ```
 */
export function createLogger(
  { sinks, }: { readonly sinks: readonly Sink[]; },
): {
  readonly initPromise: Promise<void>;
  readonly logger: Logger;
} {
  /**
   * Per-sink availability for this logger instance, indexed by startup order.
   */
  const entries: SinkEntry[] = sinks.map(function toEntry(sink,): SinkEntry {
    return {
      available: false,
      sink,
    };
  },);

  /**
   * Log records emitted before every sink has completed startup verification.
   * Records stay here only during initialization; each sink that later
   * verifies as available receives a replay, while already-available sinks
   * still receive writes immediately.
   */
  const startupRecords: LogRecord[] = [];

  /**
   * Sink writes currently in flight. Logger-level `flush()` drains these so
   * sinks without their own flush hook, such as file writes, still settle
   * before the flush resolves.
   */
  const pendingWrites = new Set<Promise<void>>();

  /**
   * Instance-local aggregate flags. `initialized` flips true once the eager
   * `initialize()` settles; `hasAvailableSink` reflects whether any sink
   * survives verification and is recomputed by `recomputeAvailability`.
   */
  const state: {
    hasAvailableSink: boolean;
    initialized: boolean;
  } = {
    hasAvailableSink: false,
    initialized: false,
  };

  /**
   * Recomputes aggregate availability after a sink entry's flag flips.
   */
  function recomputeAvailability(): void {
    state.hasAvailableSink = entries.some(function isAvailable(entry,) {
      return entry.available;
    },);
  }

  /**
   * Reads a sink entry by startup-order index.
   *
   * @param entryIndex - Sink entry index from the construction-time order.
   *
   * @returns Sink entry at that index.
   *
   * @throws Error when index no longer maps to a sink entry.
   */
  function getSinkEntry({ entryIndex, }: { readonly entryIndex: number; },): SinkEntry {
    /**
     * Sink entry read from startup-order storage; undefined means the caller supplied an invalid index.
     */
    const entry = entries[entryIndex];
    if (entry === undefined)
      throw new Error(`Missing logger sink entry at index ${entryIndex}.`,);

    return entry;
  }

  /**
   * Marks a sink unavailable after its verification fails or throws. Write
   * failures never reach here: a rejected write is the sink's own concern and
   * leaves the backend available, so one transient hiccup does not retire it.
   *
   * @param entryIndex - Sink entry index whose backend failed verification.
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
   * Removes a tracked sink write from {@link pendingWrites} once it settles.
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
       * Monitored sink write; resolves even when the underlying write rejects, because `trackWrite` swallows rejection.
       */
      const trackedWrite = trackWrite({
        writePromise: entry.sink
          .write(record,),
      },);
      pendingWrites.add(trackedWrite,);
      void removePendingWriteWhenSettled({ trackedWrite, },);
    }
    catch {
      // A synchronous throw from `write` is the sink's concern, like a
      // rejection; swallow it without retiring the backend.
    }
  }

  /**
   * Replays buffered startup records to a sink that just became available.
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
   * Applies a verification result to a sink and replays startup records on
   * success.
   *
   * @param entryIndex - Sink entry index whose verification completed.
   *
   * @param available - Whether the backend verified successfully.
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
      const verification = entry.sink
        .verify();
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
   * Initializes all sink backends by verifying their availability. Runs once
   * at construction. Verification order does not affect correctness: every
   * sink that verifies available replays the full startup buffer, so no sink
   * depends on another verifying first; the await-in-loop merely keeps a
   * synchronous verifier's result applied before the next sink starts.
   */
  async function initialize(): Promise<void> {
    if (state.initialized)
      return;

    for (const [entryIndex,] of entries.entries()) {
      /**
       * Optional async verification; sync verifiers have already completed by
       * the time `verifyEntry` returns.
       */
      const verification = verifyEntry({ entryIndex, },);
      if (verification !== SYNC_VERIFICATION_DONE)
        // oxlint-disable-next-line no-await-in-loop -- Apply each verification before the next sink starts.
        await verification;
    }

    state.initialized = true;
    startupRecords.length = 0;
  }

  /**
   * Eager readiness promise. Consumers do not need to await this before
   * logging; `flush()` awaits it internally, and startup records replay to
   * async sinks as they become available.
   */
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
   * @param level - Log severity level for messages from this method.
   *
   * @returns Logging function for the given level.
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
       * Indices of sinks that survived verification; recomputed per call so a sink dropped at verify time is excluded next time.
       */
      const availableIndices = entries
        .map(function indexEntry(
          _entry,
          entryIndex,
        ) {
          return entryIndex;
        },)
        .filter(function isAvailable(entryIndex,) {
          return getSinkEntry({ entryIndex, },)
            .available;
        },);

      availableIndices.forEach(function writeToSink(entryIndex,) {
        writeRecordToEntry({
          entryIndex,
          record,
        },);
      },);
    };
  }

  /**
   * Drains startup verification, in-flight sink writes, and every available
   * sink's own `flush` hook. Resolves once all tracked writes and hooks have
   * settled. A rejecting `flush` hook marks that sink unavailable and does not
   * fail the aggregate.
   */
  async function flushAll(): Promise<void> {
    await initPromise;
    await drainPendingWrites();
    await Promise.all(
      entries.map(async function runFlush(
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
   */
  const logger: Logger = {
    debug: createMethod('debug',),
    error: createMethod('error',),
    fatal: createMethod('fatal',),
    flush: flushAll,
    info: createMethod('info',),
    trace: createMethod('trace',),
    warn: createMethod('warn',),
  };

  return {
    initPromise,
    logger,
  };
}
