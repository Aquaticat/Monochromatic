import { watch, } from 'node:fs/promises';
import {
  l,
  tagged,
} from '../log.ts';
import {
  classifyEvent,
  type EventKind,
} from './watch-filter.ts';

/** Minimum delay between re-runs to avoid overlapping executions from rapid saves */
export const DEBOUNCE_MS = 100;

/**
 * Starts an fs.watch loop for a single directory, classifying events and
 * calling the appropriate callback.
 *
 * Runs until the abort signal fires. AbortError is silently caught since
 * it is the expected teardown mechanism.
 *
 * @param dir - Absolute directory path to watch
 *
 * @param signal - AbortSignal for teardown
 *
 * @param configPath - Absolute config path for event classification
 *
 * @param onEvent - Callback receiving the event kind and the changed filename
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * await watchDirectory({
 *   dir: '/abs/src',
 *   signal: controller.signal,
 *   configPath: '/abs/config.ts',
 *   onEvent: function logEvent(kind, filename) {
 *     console.log(kind, filename);
 *   },
 * });
 * ```
 */
export async function watchDirectory(
  {
    dir,
    signal,
    configPath,
    onEvent,
  }: {
    readonly dir: string;
    readonly signal: AbortSignal;
    readonly configPath: string;
    readonly onEvent: (
      kind: EventKind,
      filename: string,
    ) => void;
  },
): Promise<void> {
  /** Function-scoped logger tagged with the call site for traceable watcher logs. */
  const rl = tagged({
    tag: watchDirectory.name,
    l,
  },);
  try {
    /** Async iterator yielding filesystem events in this directory */
    const watcher = watch(
      dir,
      { signal, },
    );
    // for-await is the only way to consume an AsyncIterable from fs.watch:
    // there is no functional alternative for an unbounded event stream.
    for await (const event of watcher) {
      if (event.filename === null)
        continue;
      /** Classification determines whether this event triggers action */
      // oxlint-disable-next-line no-await-in-loop -- sequential event processing required by async iterator
      const kind = await classifyEvent({
        filename: event.filename,
        watchedDir: dir,
        configPath,
      },);
      if (kind === 'ignore')
        continue;
      onEvent(
        kind,
        event.filename,
      );
    }
  }
  catch (watchError: unknown) {
    // AbortError is expected when closing watchers during re-setup
    if ((watchError instanceof Error) && (watchError.name === 'AbortError'))
      return;
    rl.error(`watcher error in ${dir}: ${String(watchError,)}`,);
  }
}
