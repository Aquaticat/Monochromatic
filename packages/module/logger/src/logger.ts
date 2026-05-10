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
  available: boolean | null;
  sink: Sink;
  verify: Verify;
};

/** All sink backends to attempt, in priority order. */
const sinkEntries: SinkEntry[] = [
  {
    available: null,
    sink: consoleSink,
    verify: verifyConsole,
  },
  {
    available: null,
    sink: opfsSink,
    verify: verifyOpfs,
  },
  {
    available: null,
    sink: sessionStorageSink,
    verify: verifySessionStorage,
  },
  {
    available: null,
    sink: fileSink,
    verify: verifyFile,
  },
];

/** Whether initialization has completed. */
let initialized = false;

/** Whether at least one sink backend is available. */
let hasAvailableSink = false;

/**
 * Initializes all sink backends by verifying their availability.
 * Runs once at module load time.
 */
async function initialize(): Promise<void> {
  if (initialized)
    return;

  for (const entry of sinkEntries) {
    try {
      const result = entry.verify();
      // oxlint-disable-next-line no-await-in-loop -- Sinks must be verified sequentially to avoid race conditions
      entry.available = result instanceof Promise ? await result : result;
      if (entry.available)
        hasAvailableSink = true;
    }
    catch {
      entry.available = false;
    }
  }

  initialized = true;

  if (!hasAvailableSink)
    throw new Error('No logging backends available',);
}

/** Eager initialization promise: throws at module load if no backends available. */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- fire-and-forget initialization, not awaited
const initPromise: Promise<void> = initialize();

/**
 * Marks a sink entry as failed and recalculates global availability.
 *
 * @param entry - Sink entry that encountered an error
 */
function markFailed(entry: SinkEntry,): void {
  entry.available = false;
  hasAvailableSink = sinkEntries.some(function isAvailable(sinkEntry,) {
    return sinkEntry.available === true;
  },);
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
    if (!hasAvailableSink && initialized)
      throw new Error('No logging backends available',);

    const available = sinkEntries.filter(function isAvailable(entry,) {
      return entry.available === true;
    },);
    if (available.length === 0)
      return;

    const record: LogRecord = {
      level,
      message,
      timestamp: Date.now(),
    };

    available.forEach(function writeToSink(entry,) {
      try {
        const result = entry.sink.write(record,);
        if (result instanceof Promise) {
          // Fire-and-forget: awaiting would make the logger blocking
          // oxlint-disable-next-line promise/prefer-await-to-then -- intentional fire-and-forget
          void result.then(
            // oxlint-disable-next-line promise/always-return -- fire-and-forget success handler
            function noop() {/* success */},
            function onReject() {
              markFailed(entry,);
            },
          );
        }
      }
      catch {
        markFailed(entry,);
      }
    },);

    if (!hasAvailableSink)
      throw new Error('All logging backends have failed',);
  };
}

/**
 * Drains buffered records in every available sink that exposes its own
 * `flush` hook. Resolves once all hooks have settled. Per-sink failures
 * are isolated: a rejecting `flush` marks that sink unavailable and does
 * not fail the aggregate.
 *
 * Safe to call when no sink buffers -- resolves immediately.
 *
 * @example
 * ```ts
 * l.error('crash');
 * await l.flush(); // ensures the error is visible before the next step
 * ```
 */
async function flushAll(): Promise<void> {
  await Promise.all(
    sinkEntries.map(async function runFlush(entry,) {
      const sinkFlush = entry.sink.flush;
      if (entry.available !== true || typeof sinkFlush !== 'function')
        return;
      try {
        await sinkFlush();
      }
      catch {
        markFailed(entry,);
      }
    },),
  );
}

/**
 * Multi-sink logger that writes to all available backends.
 * Throws if no backends are available at initialization or if all fail.
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
