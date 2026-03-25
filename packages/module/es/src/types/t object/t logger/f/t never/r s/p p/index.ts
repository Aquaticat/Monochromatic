import {
  $ as consoleSink,
  verify as verifyConsole,
} from '../../../../t sink/t console/r s/p p/index.ts';
import {
  $ as fileSink,
  verify as verifyFile,
} from '../../../../t sink/t file/p p/index.ts';
import {
  $ as opfsSink,
  verify as verifyOpfs,
} from '../../../../t sink/t opfs/p p/index.ts';
import {
  $ as sessionStorageSink,
  verify as verifySessionStorage,
} from '../../../../t sink/t sessionStorage/r s/p p/index.ts';
import type {
  $ as Logger,
  Level,
  LogRecord,
  Sink,
  Verify,
} from '../../../../t/index.ts';

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

/** Eager initialization promise -- throws at module load if no backends available. */
// oxlint-disable-next-line unicorn/prefer-top-level-await -- fire-and-forget initialization, not awaited
const initPromise: Promise<void> = initialize();

/**
 * Creates a logging method for the specified severity level.
 * @param level - Log severity level for messages from this method
 */
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
        const result = entry.sink(record,);
        if (result instanceof Promise) {
          // Fire-and-forget: awaiting would make the logger blocking
          // oxlint-disable-next-line promise/prefer-await-to-then, promise/always-return -- intentional fire-and-forget
          void result.then(
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
 * Multi-sink logger that writes to all available backends.
 * Throws if no backends are available at initialization or if all fail.
 */
export const $: Logger = {
  debug: createMethod('debug',),
  error: createMethod('error',),
  fatal: createMethod('fatal',),
  info: createMethod('info',),
  trace: createMethod('trace',),
  warn: createMethod('warn',),
};

export { initPromise, };
