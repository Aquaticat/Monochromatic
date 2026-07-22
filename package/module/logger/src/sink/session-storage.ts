import { reportLoggerInternalError, } from '../error-format.ts';
import { createSessionStorageStore, } from './session-storage-store.ts';

import type {
  Level,
  Sink,
} from '../types.ts';

/**
 * Buffered code units that force a synchronous flush from inside `write`
 * itself. 32 KiB sits in the measured flat bottom of the batch-size curve on
 * Chromium 149 and Node 26 (0.15 µs to 1.7 µs per record versus 5 µs to
 * 15 µs unbatched) while staying clear of the measured U-turn where flushes
 * past ~100 KiB cost more per record than not batching; see
 * `doc/troubleshooting/web-storage-sink-main-thread-cost.md`. Because this
 * flush runs synchronously inside `write`, a wedged main thread that keeps
 * logging can never hold more than one cap's worth of unpersisted records.
 */
const FLUSH_BUFFER_CAP_CHARS = 32_768;

/**
 * Quiet-period deadline before a buffered record is flushed by timer, so
 * low-volume sessions stay readable in the store without waiting for the
 * byte cap. Each deadline flush costs one `setItem` (about 5 µs to 15 µs), so
 * this cadence is negligible while keeping the crash-loss window for idle
 * periods under a quarter second.
 */
const FLUSH_DEADLINE_MS = 250;

/**
 * Severities that flush the buffer synchronously from inside `write`, so
 * every record up to and including a warning or worse is persisted before
 * control returns to the caller. Failure forensics is the sink's purpose;
 * these records are rare, so paying the per-batch cost immediately for them
 * does not dent the amortization of the bulk `debug`/`trace`/`info` volume.
 */
const FLUSH_IMMEDIATELY_BY_LEVEL: Record<Level, boolean> = {
  debug: false,
  error: true,
  fatal: true,
  info: false,
  trace: false,
  warn: true,
};

/**
 * Timer handle exposing Node's keep-alive release. Browsers return a bare
 * number from `setTimeout` and need no release; Node returns an object whose
 * `unref` lets the process exit while the timer is pending.
 */
type UnrefableTimer = { readonly unref: () => void; };

/**
 * Narrows a `setTimeout` return value to a handle exposing `unref`, so a
 * pending deadline flush never pins a server process open past its work.
 *
 * @param timer - Return value of `globalThis.setTimeout`.
 *
 * @returns Whether `timer` exposes a callable `unref`.
 */
function isUnrefableTimer(timer: unknown,): timer is UnrefableTimer {
  if (((typeof timer) !== 'object') || (timer === null))
    return false;
  if (!('unref' in timer))
    return false;
  return (typeof timer.unref) === 'function';
}

/**
 * Verifies sessionStorage actually persists data. Stateless: the logger calls
 * this once per sink at startup and owns the resulting availability, so no
 * verified/available flag is kept here.
 *
 * Election is by probe alone: any runtime whose `sessionStorage` round-trips
 * (browsers, Node 22+, Deno) keeps the sink, and the buffered write path
 * keeps the per-record cost acceptable everywhere rather than a runtime brand
 * check deciding who may log here.
 *
 * @returns Whether sessionStorage is available and round-trips a probe write.
 *
 * @example
 * ```ts
 * if (await verifySessionStorage()) {
 *   // sessionStorage usable
 * }
 * ```
 */
function verifySessionStorage(): Promise<boolean> {
  try {
    /**
     * Sentinel key used only for the probe write/read; removed afterward to avoid polluting real log entries.
     */
    const testKey = '__monochromatic_verify__';
    /**
     * Timestamp-based probe value so concurrent verifications never read each other's writes.
     */
    const testValue = `test-${Date.now()}`;
    globalThis.sessionStorage
      .setItem(
      testKey,
      testValue,
    );
    /**
     * Probe value read back from storage; equality with `testValue` proves writes actually persist.
     */
    const readBack = globalThis.sessionStorage
      .getItem(testKey,);
    globalThis.sessionStorage
      .removeItem(testKey,);
    return Promise.resolve(readBack === testValue,);
  }
  catch (error: unknown) {
    if ('sessionStorage' in globalThis)
      reportLoggerInternalError({
        context: 'sessionStorage sink verification failed',
        error,
      },);
    return Promise.resolve(false,);
  }
}

/**
 * Builds a sessionStorage sink that buffers serialized records and persists
 * them as newline-joined JSONL batches, one batch per counter-incremented
 * key, through {@link createSessionStorageStore}. One uniform write path runs
 * on every runtime; no per-runtime mode exists.
 *
 * A batch flushes synchronously from inside `write` when it reaches
 * {@link FLUSH_BUFFER_CAP_CHARS} or when the record's severity is `warn` or
 * worse, by timer after {@link FLUSH_DEADLINE_MS} of quiet, on `pagehide` and
 * on the document becoming hidden (where those events exist), and on the
 * sink's `flush` hook via logger-level `flush()`. The byte-cap and severity
 * flushes run on the caller's stack, so neither a synchronous workload nor a
 * wedged main thread can accumulate more than one cap of unpersisted records.
 *
 * @returns Sink backed by web `sessionStorage`.
 *
 * @example
 * ```ts
 * const { logger } = createLogger({ sinks: [createSessionStorageSink()] });
 * logger.info('user signed in'); // buffered
 * logger.warn('quota near');     // flushes both records in one batch
 * ```
 */
export function createSessionStorageSink(): Sink {
  /**
   * Persistence engine owning key allocation, footprint accounting, and quota
   * eviction; this closure only decides when a batch is handed to it.
   */
  const store = createSessionStorageStore();

  /**
   * Serialized records awaiting one joined `setItem`; drained in write order
   * by every flush trigger.
   */
  const bufferEntries: string[] = [];

  /**
   * Instance-local buffer bookkeeping. `chars` mirrors the joined length of
   * {@link bufferEntries} (records plus one separator between neighbors) so
   * cap checks need no re-summing; `timer`, present only while armed, holds
   * the quiet-period deadline flush so idle sessions still persist.
   */
  const bufferState: {
    chars: number;
    timer?: ReturnType<typeof globalThis.setTimeout>;
  } = { chars: 0, };

  /**
   * Joined length the buffer would have after appending `serialized`,
   * counting the newline separator a non-empty buffer needs before it.
   *
   * @param serialized - Record about to be appended.
   *
   * @returns Prospective joined batch length in code units.
   */
  function charsWith(serialized: string,): number {
    /**
     * Newline separator the join adds before this record when the buffer already holds one.
     */
    const separatorChars = (bufferEntries.length > 0) ? 1 : 0;
    /**
     * Length of the buffer as currently joined, before this record.
     */
    const joinedChars = bufferState.chars + separatorChars;
    return joinedChars + serialized.length;
  }

  /**
   * Persists the buffered records as one newline-joined batch and disarms the
   * deadline timer. Runs synchronously so byte-cap and severity flushes
   * complete on the caller's stack. Safe to call with an empty buffer.
   */
  function flushNow(): void {
    if (bufferState.timer !== undefined) {
      globalThis.clearTimeout(bufferState.timer,);
      delete bufferState.timer;
    }
    if (bufferEntries.length === 0)
      return;
    /**
     * Newline-joined JSONL batch; `JSON.stringify` escapes newlines inside
     * records, so the separator is unambiguous for readers splitting lines.
     */
    const batch = bufferEntries.join('\n',);
    bufferEntries.length = 0;
    bufferState.chars = 0;
    store.persist(batch,);
  }

  /**
   * Arms the quiet-period deadline flush if none is pending, releasing the
   * runtime's keep-alive where the handle supports it so a pending flush
   * never holds a process open.
   */
  function scheduleDeadlineFlush(): void {
    if (bufferState.timer !== undefined)
      return;
    /**
     * Freshly armed deadline handle; kept on {@link bufferState} so a cap or severity flush can disarm it.
     */
    const timer = globalThis.setTimeout(
      flushNow,
      FLUSH_DEADLINE_MS,
    );
    if (isUnrefableTimer(timer,))
      timer.unref();
    bufferState.timer = timer;
  }

  /**
   * Buffers a log record, flushing synchronously when the joined batch
   * reaches the byte cap or the record's severity is `warn` or worse. When an
   * addition would breach the cap, the existing entries flush first so an
   * oversized record's quota give-up can only ever drop that record, never
   * its batch-mates.
   *
   * @param record - Log record to buffer and eventually persist.
   *
   * @mutates record - `JSON.stringify` may invoke `toJSON`, getters, or proxy traps.
   */
  function write(record: {
    level: Level;
    message: string;
    timestamp: number;
  },): Promise<void> {
    /**
     * Serialized record; computed once so flushes re-use the same value without re-stringifying.
     */
    const serialized = JSON.stringify(record,);

    // Protect batch-mates: an addition that would breach the cap flushes the
    // current entries first, isolating any oversized record in its own batch.
    if ((bufferEntries.length > 0) && (charsWith(serialized,) > FLUSH_BUFFER_CAP_CHARS))
      flushNow();

    bufferState.chars = charsWith(serialized,);
    bufferEntries.push(serialized,);

    if (FLUSH_IMMEDIATELY_BY_LEVEL[record.level] || (bufferState.chars >= FLUSH_BUFFER_CAP_CHARS))
      flushNow();
    else
      scheduleDeadlineFlush();

    return Promise.resolve();
  }

  /**
   * {@inheritDoc flushNow}
   */
  function flush(): Promise<void> {
    flushNow();
    return Promise.resolve();
  }

  // A leaving or hidden page is the last chance to persist; both hooks are
  // harmless no-ops on runtimes where the events never fire.
  globalThis.addEventListener?.(
    'pagehide',
    flushNow,
  );
  globalThis.document
    ?.addEventListener(
      'visibilitychange',
      function flushWhenHidden(): void {
        /**
         * Current page visibility; the listener only fires where a document exists.
         */
        const visibility = globalThis.document
          ?.visibilityState;
        if (visibility === 'hidden')
          flushNow();
      },
    );

  return {
    flush,
    verify: verifySessionStorage,
    write,
  };
}
