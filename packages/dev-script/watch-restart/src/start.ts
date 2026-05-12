import {
  Child,
  type SpawnFn,
} from './child.ts';
import { composeFilters, } from './filters/compose.ts';
import { contentHashFilter, } from './filters/content-hash.ts';
import { extFilter, } from './filters/ext.ts';
import { globFilter, } from './filters/glob.ts';
import { typeFilter, } from './filters/type.ts';
import {
  DEFAULT_MAX_HASH_SIZE_BYTES,
  HashCache,
} from './hash-cache.ts';
import {
  l as defaultLogger,
  type Logger,
  tagged,
} from './log.ts';
import type {
  WatchCtx,
  WatchEntityType,
  WatchEvent,
  WatchEventKind,
  WatchFilter,
} from './types.ts';
import { Watcher, } from './watcher.ts';

/**
 * Default debounce window (ms) between the last qualifying event and the
 * actual restart. Two events inside the window coalesce to one restart;
 * 100 ms is short enough to feel instant on a save and long enough to
 * absorb a multi-file format-on-save burst.
 */
export const DEFAULT_DEBOUNCE_MS = 100;

/**
 * Options for {@link startWatchRestart}.
 *
 * Mirrors the CLI flag surface (`-w`, `-i`, `-e`, `--ext`, ...) so the CLI
 * parses straight into this shape with no second translation layer. Each
 * field that gates a filter is `?`-optional and unset means "do not
 * apply this filter dimension"; `contentChanged === undefined` defaults
 * to `true` (the package's reason for being) — only an explicit `false`
 * opts out.
 */
export type StartWatchRestartOptions = {
  /** Watch roots; at least one is expected by `Watcher`. */
  readonly paths: readonly string[];
  /** Command to run; first positional after `--` at the CLI. */
  readonly command: string;
  /** Argument list for the command; remaining positionals at the CLI. */
  readonly args?: readonly string[];
  /** Include glob patterns matched against {@link WatchEvent.relativePath}. */
  readonly include?: readonly string[];
  /** Exclude glob patterns; an exclude match short-circuits to skip. */
  readonly exclude?: readonly string[];
  /** Extensions admitted (case-insensitive, leading dot optional). */
  readonly extensions?: readonly string[];
  /**
   * Entity types admitted; `undefined` defaults to `['file']` so the
   * dev-server case (the package's reason for being) sees only file
   * events. Pass `['file', 'dir']` to include directory create/remove.
   */
  readonly types?: readonly WatchEntityType[];
  /** Event kinds admitted; `undefined` admits all kinds reaching the filter. */
  readonly events?: readonly WatchEventKind[];
  /** Suppress byte-identical writes when `true` (default); `false` disables. */
  readonly contentChanged?: boolean;
  /** Cap on file size hashed by {@link contentHashFilter}; default 16 MiB. */
  readonly maxHashSize?: number;
  /** Debounce window (ms); coalesces multi-event bursts. Default 100. */
  readonly debounce?: number;
  /** SIGTERM-to-SIGKILL grace (ms) for the child; default 5_000. */
  readonly stopTimeout?: number;
  /** Run the child at start when `true` (default); `false` defers to first event. */
  readonly initial?: boolean;
  /** Optional user predicate AND'd onto the internal chain (runs last). */
  readonly filter?: WatchFilter;
  /** Parent logger; the orchestrator composes a `startWatchRestart` tag on top. */
  readonly logger?: Logger;
  /** Spawn factory forwarded to {@link Child}; tests inject a recording fake. */
  readonly spawn?: SpawnFn;
};

/**
 * Handle returned by {@link startWatchRestart}.
 *
 * The orchestrator's lifetime is bounded by `stop()`: a second `stop()`
 * call is a no-op (idempotent), matching `Watcher.stop` and `Child.stop`.
 */
export type WatchRestartHandle = {
  /** Aborts ctx.signal, clears debounce timer, stops watcher then child. */
  readonly stop: () => Promise<void>;
};

/**
 * Builds a {@link WatchFilter} that passes only events whose `kind` is in
 * the allowed list.
 *
 * Module-scope helper rather than a generic `filters/event-kind.ts`
 * module because this is the only consumer; the orchestrator already
 * owns the option-to-filter mapping and pulling a one-line filter into
 * its own file would obscure the chain.
 *
 * @param allowed - event kinds admitted; checked via Set membership
 *
 * @returns watch filter that returns `true` iff `event.kind` is admitted
 *
 * @example
 * ```ts
 * const filter = buildEventKindFilter(['change',],);
 * ```
 */
function buildEventKindFilter(
  allowed: readonly WatchEventKind[],
): WatchFilter {
  /** Set built once at construction for O(1) lookup on the event hot path. */
  const allowedSet: ReadonlySet<WatchEventKind> = new Set<WatchEventKind>(
    allowed,
  );
  return function eventKindFilterFn(
    {
      event,
    }: {
      readonly event: WatchEvent;
      readonly ctx: WatchCtx;
    },
  ): boolean {
    return allowedSet.has(event.kind,);
  };
}

/**
 * Assembles the internal filter chain from {@link StartWatchRestartOptions}.
 *
 * Order matters for efficiency: cheap sync filters first (event kind, ext,
 * glob), then I/O (content hash), then the user filter last (opaque cost).
 * Within an `all-of` composition this is a strict short-circuit: a non-
 * matching ext never causes a disk hash.
 *
 * `contentChanged === undefined` includes the hash filter (package's
 * reason for being); only an explicit `false` opts out. Naive
 * `if (options.contentChanged)` would skip the filter when unset and
 * silently break the dev-loop contract.
 *
 * @param options - same shape passed to {@link startWatchRestart}
 *
 * @returns single composed {@link WatchFilter} (potentially vacuous true)
 *
 * @example
 * ```ts
 * const filter = buildInternalFilter({
 *   paths: ['src',], command: 'bun',
 *   extensions: ['.ts',], contentChanged: true,
 * },);
 * ```
 */
function buildInternalFilter(
  options: StartWatchRestartOptions,
): WatchFilter {
  /** Mutable working list of filters; collected in evaluation order before composition. */
  const filters: WatchFilter[] = [];

  /**
   * Default `types` to `['file']` so the baseline dev-server case (the
   * package's reason for being) ignores the new `addDir`/`unlinkDir`
   * events the watcher started emitting in Q6. Callers that want
   * directory events pass `['file', 'dir']` or `['dir']`.
   */
  const types: readonly WatchEntityType[] = options.types ?? ['file',];
  filters.push(typeFilter(types,),);

  if (options.events !== undefined) {
    filters.push(buildEventKindFilter(options.events,),);
  }
  if (options.extensions !== undefined && options.extensions.length > 0) {
    filters.push(extFilter(options.extensions,),);
  }
  if (
    (options.include !== undefined && options.include.length > 0)
    || (options.exclude !== undefined && options.exclude.length > 0)
  ) {
    filters.push(globFilter({
      ...(options.include === undefined ? {} : { include: options.include, }),
      ...(options.exclude === undefined ? {} : { exclude: options.exclude, }),
    },),);
  }
  if (options.contentChanged !== false) {
    filters.push(contentHashFilter(),);
  }
  if (options.filter !== undefined) {
    filters.push(options.filter,);
  }

  return composeFilters(filters,);
}

/**
 * Starts a long-running watch/restart loop.
 *
 * Wires the four building blocks together:
 *
 * 1. {@link HashCache} (shared, pre-populated by Watcher's initial walk).
 * 2. {@link Watcher} (chokidar adapter; absorbs pre-`ready` events into the cache).
 * 3. Filter chain assembled by {@link buildInternalFilter} (the configured
 *    flag-derived filters AND'd with the user-supplied predicate).
 * 4. {@link Child} (the spawn/restart/stop wrapper; receives `SIGTERM`
 *    with `stopTimeout` grace before `SIGKILL`).
 *
 * Each post-`ready` event runs through the filter chain. A passing event
 * (re)schedules a debounced restart: the timer is reset on every passing
 * event, so a burst within the window coalesces to a single restart at
 * the end of the window. When `options.initial !== false`, the child is
 * spawned immediately after the watcher reaches ready.
 *
 * The handle's `stop()` aborts the shared abort signal first (so any
 * in-flight filter awaiting `ctx.signal` exits cleanly), then clears
 * the debounce timer, stops the watcher, and stops the child. Calling
 * `stop()` twice is a no-op on every layer (idempotent).
 *
 * @param options - options object; see {@link StartWatchRestartOptions}
 *
 * @returns handle whose `stop()` tears the whole loop down cleanly
 *
 * @example
 * ```ts
 * const handle = await startWatchRestart({
 *   paths: ['src/server',],
 *   command: 'bun',
 *   args: ['src/server/index.ts',],
 * },);
 * // ... later, on Ctrl+C:
 * await handle.stop();
 * ```
 */
export async function startWatchRestart(
  options: StartWatchRestartOptions,
): Promise<WatchRestartHandle> {
  /** Resolved parent logger; the orchestrator and inner subsystems compose tags onto it. */
  const parentLogger: Logger = options.logger ?? defaultLogger;
  /** Tagged logger for this orchestrator's own log lines. */
  const startLogger: Logger = tagged({
    tag: startWatchRestart.name,
    l: parentLogger,
  },);

  /** Shared content-hash cache; pre-populated by the Watcher, read by `contentHashFilter`. */
  const hashCache = new HashCache({
    maxHashSize: options.maxHashSize ?? DEFAULT_MAX_HASH_SIZE_BYTES,
  },);

  /** Shared abort controller; flipped during `stop()` so in-flight filters can bail. */
  const abort = new AbortController();
  /** Context handed to every filter invocation. */
  const ctx: WatchCtx = {
    logger: startLogger,
    signal: abort.signal,
    hashCache,
  };

  /** Composed filter chain assembled once at start; evaluated on every event. */
  const internalFilter: WatchFilter = buildInternalFilter(options,);
  /** Resolved debounce window. */
  const debounceMs: number = options.debounce ?? DEFAULT_DEBOUNCE_MS;

  /** Underlying child manager. */
  const child = new Child({
    command: options.command,
    ...(options.args === undefined ? {} : { args: options.args, }),
    ...(options.stopTimeout === undefined
      ? {}
      : { stopTimeout: options.stopTimeout, }),
    logger: startLogger,
    ...(options.spawn === undefined ? {} : { spawn: options.spawn, }),
  },);

  /**
   * Const-bound mutable container for the debounce timer handle.
   * Avoids the function-root `let` ban while keeping the timer addressable
   * from `scheduleRestart` and `stop`.
   */
  const state: {
    timer: ReturnType<typeof setTimeout> | undefined;
  } = { timer: undefined, };

  /**
   * Resets the debounce window: a new event ties for "latest", so the
   * restart fires `debounceMs` after THIS event, not the original first
   * one. Timer handle is cleared before the async restart starts so a
   * fresh event arriving mid-restart cannot see a stale handle.
   */
  function scheduleRestart(): void {
    if (state.timer !== undefined) {
      clearTimeout(state.timer,);
    }
    state.timer = setTimeout(
      function fireRestart(): void {
        state.timer = undefined;
        void (async function doRestart(): Promise<void> {
          try {
            await child.restart();
          }
          catch (error) {
            const message = error instanceof Error
              ? error.message
              : String(error,);
            startLogger.error(`restart failed: ${message}`,);
          }
        })();
      },
      debounceMs,
    );
  }

  /**
   * Watcher's per-event callback. Runs the filter chain; on `true`, kicks
   * the debounce; on `false`, drops the event. Filter exceptions are
   * logged but never propagated (a single bad predicate must not crash
   * the dev loop).
   *
   * @param event - normalised event from {@link Watcher}
   */
  async function onEvent(event: WatchEvent,): Promise<void> {
    try {
      const passed = await internalFilter({
        event,
        ctx,
      },);
      if (passed) {
        scheduleRestart();
      }
    }
    catch (error) {
      const message = error instanceof Error
        ? error.message
        : String(error,);
      startLogger.error(
        `filter chain failed for ${event.path}: ${message}`,
      );
    }
  }

  const watcher = new Watcher({
    paths: options.paths,
    hashCache,
    onEvent,
    logger: startLogger,
  },);

  await watcher.untilReady();

  if (options.initial !== false) {
    await child.start();
  }

  /**
   * Tears down the loop. Order matters: abort first so in-flight filter
   * awaits on `ctx.signal` return early; then drop any pending debounce
   * to prevent a phantom restart during teardown; finally stop the
   * watcher (which closes OS handles) and the child (which sends
   * SIGTERM/SIGKILL). Both `Watcher.stop` and `Child.stop` are
   * idempotent, so a second `handle.stop()` is harmless.
   */
  async function stop(): Promise<void> {
    abort.abort();
    if (state.timer !== undefined) {
      clearTimeout(state.timer,);
      state.timer = undefined;
    }
    await watcher.stop();
    await child.stop();
  }

  return { stop, };
}
