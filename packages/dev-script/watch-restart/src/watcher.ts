import {
  type FSWatcher,
  watch as chokidarWatch,
} from 'chokidar';
import { once, } from 'node:events';
import {
  extname,
  relative,
  resolve,
  sep,
} from 'node:path';
import type { HashCache, } from './hash-cache.ts';
import {
  l as defaultLogger,
  type Logger,
  tagged,
} from './log.ts';
import type {
  WatchEvent,
  WatchEventKind,
} from './types.ts';

/**
 * Default `awaitWriteFinish.stabilityThreshold` (milliseconds).
 * Tuned for editors that write the final byte then move on; matches
 * chokidar's recommended floor for "saved by a human" timing.
 */
const DEFAULT_STABILITY_THRESHOLD_MS = 50;

/**
 * Default `awaitWriteFinish.pollInterval` (milliseconds).
 * How often chokidar re-stats a candidate file while waiting for stability;
 * 10ms keeps the latency low without burning CPU on a typical dev box.
 */
const DEFAULT_POLL_INTERVAL_MS = 10;

/**
 * Predicate testing whether a path should be skipped by chokidar's traversal.
 *
 * `Matcher` in chokidar 5 admits string (literal path), RegExp, function, or
 * `{ path, recursive }`. The orchestrator compiles all flag inputs to
 * functions ahead of time (via picomatch), so this adapter accepts the
 * function form only and ignores the others.
 *
 * @example
 * ```ts
 * const isNodeModules: IgnoredPredicate = function isNm(p,) {
 *   return p.includes('/node_modules/',);
 * };
 * ```
 */
export type IgnoredPredicate = (path: string,) => boolean;

/**
 * Stability/polling tuning for chokidar's `awaitWriteFinish`.
 * Splitting it out keeps the {@link WatcherOptions} shape narrow.
 */
export type AwaitWriteFinishOptions = {
  /** Milliseconds the file size must hold steady before an event emits. */
  readonly stabilityThreshold: number;
  /** Milliseconds between size re-stats during the stability window. */
  readonly pollInterval: number;
};

/**
 * Construction options for {@link Watcher}.
 */
export type WatcherOptions = {
  /** Roots to watch. Resolved to absolute on construction. */
  readonly paths: readonly string[];
  /** Shared content-hash cache; pre-populated during the initial walk. */
  readonly hashCache: HashCache;
  /** Predicates that skip files/directories during traversal (efficiency only; not a filter substitute). */
  readonly ignored?: readonly IgnoredPredicate[];
  /** Forwarded to chokidar's `atomic` option; defaults to `true`. */
  readonly atomic?: boolean | number;
  /** Forwarded to chokidar's `awaitWriteFinish`; defaults to `{ stabilityThreshold: 50, pollInterval: 10 }`. */
  readonly awaitWriteFinish?: AwaitWriteFinishOptions;
  /** Callback fired for each post-`ready` event. Async callbacks are not awaited by chokidar. */
  readonly onEvent: (event: WatchEvent,) => void | Promise<void>;
  /** Parent logger; the watcher composes a `Watcher` tag on top. */
  readonly logger?: Logger;
};

/**
 * Wraps `path.resolve` for use with `Array.prototype.map`.
 * Module-scope so the closure does not capture and the lint stays clean.
 *
 * @param p - path to resolve
 *
 * @returns absolute path
 */
function resolveOne(p: string,): string {
  return resolve(p,);
}

/**
 * Resolves and sorts watch roots so the deepest match wins when a file
 * lives under nested overlapping roots.
 *
 * @param paths - watch roots from {@link WatcherOptions.paths}
 *
 * @returns roots resolved to absolute paths, sorted longest-first
 *
 * @example
 * ```ts
 * sortRootsByLengthDesc(['src', 'src/server',],); // ['/abs/src/server', '/abs/src']
 * ```
 */
function sortRootsByLengthDesc(paths: readonly string[],): readonly string[] {
  const copy: string[] = paths.map(function mapResolve(p,) {
    return resolveOne(p,);
  },);
  copy.sort(function byLengthDesc(
    a,
    b,
  ): number {
    return b.length - a.length;
  },);
  return copy;
}

/**
 * Tests whether `absPath` lives inside (or equals) `root`.
 *
 * @param root - absolute directory path (no trailing separator required)
 *
 * @param absPath - absolute path to test
 *
 * @returns true when `absPath === root` or `absPath` is a child of `root`
 *
 * @example
 * ```ts
 * isPathUnderRoot({ root: '/abs/src', absPath: '/abs/src/index.ts', },); // true
 * isPathUnderRoot({ root: '/abs/src', absPath: '/abs/srcZ/index.ts', },); // false
 * ```
 */
function isPathUnderRoot(
  {
    root,
    absPath,
  }: {
    readonly root: string;
    readonly absPath: string;
  },
): boolean {
  if (absPath === root)
    return true;
  const prefix = root.endsWith(sep,) ? root : root + sep;
  return absPath.startsWith(prefix,);
}

/**
 * Coerces an unknown thrown value into a printable string for logging.
 *
 * @param error - thrown value of unknown shape
 *
 * @returns human-readable error description
 */
function describeError(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/**
 * chokidar 5 adapter that owns one `FSWatcher`, pre-populates a {@link HashCache}
 * during the initial walk (events before `ready`), and forwards live events
 * (events after `ready`) to {@link WatcherOptions.onEvent} as normalised
 * {@link WatchEvent}s.
 *
 * Pre-`ready` events are absorbed: their handler hashes the file and stores
 * the digest, but does not call `onEvent`. This is the "first sighting is not
 * a change" rule the README and HANDOVER document; without it, every file on
 * disk would look like an add event the first time the dev loop boots.
 *
 * `untilReady()` waits for chokidar's `ready` event AND drains any in-flight
 * pre-populate hash work. Without the drain, post-`ready` events for files
 * whose pre-populate is still running would race the empty cache and fire a
 * spurious restart.
 *
 * @example
 * ```ts
 * const watcher = new Watcher({
 *   paths: ['src/server',],
 *   hashCache,
 *   onEvent: async function onEvent(event,) { console.log(event,); },
 * },);
 * await watcher.untilReady();
 * // ... later
 * await watcher.stop();
 * ```
 */
export class Watcher {
  /** Underlying chokidar instance. */
  readonly #fsw: FSWatcher;
  /** Watch roots resolved to absolute, sorted deepest-first for `#findRoot`. */
  readonly #resolvedRoots: readonly string[];
  /** Shared hash cache; the watcher writes during pre-populate, filters read post-ready. */
  readonly #hashCache: HashCache;
  /** Live-event callback handed in by the orchestrator. */
  readonly #onEvent: (event: WatchEvent,) => void | Promise<void>;
  /** Tagged logger composed onto the parent. */
  readonly #logger: Logger;
  /**
   * In-flight pre-populate promises; drained by {@link untilReady}.
   */
  readonly #prePopulate: Set<Promise<void>> = new Set<Promise<void>>();
  /** Flips `true` once chokidar emits `ready`; flips event handling from pre-populate to forward. */
  #ready: boolean = false;

  /**
   * Wires chokidar up but does not block for the initial walk; call
   * {@link untilReady} to wait for the pre-populate to drain.
   *
   * @param options - construction options
   *
   * @example
   * ```ts
   * const watcher = new Watcher({ paths: ['src',], hashCache, onEvent, },);
   * await watcher.untilReady();
   * ```
   */
  constructor(options: WatcherOptions,) {
    this.#resolvedRoots = sortRootsByLengthDesc(options.paths,);
    this.#hashCache = options.hashCache;
    this.#onEvent = options.onEvent;
    this.#logger = tagged({
      tag: Watcher.name,
      l: options.logger ?? defaultLogger,
    },);

    this.#fsw = chokidarWatch(
      [...this.#resolvedRoots,],
      {
        atomic: options.atomic ?? true,
        awaitWriteFinish: options.awaitWriteFinish ?? {
          stabilityThreshold: DEFAULT_STABILITY_THRESHOLD_MS,
          pollInterval: DEFAULT_POLL_INTERVAL_MS,
        },
        ignoreInitial: false,
        persistent: true,
        // Conditional spread keeps `ignored` absent when the caller passes none;
        // ChokidarOptions's `Partial<>` allows missing keys but not explicit `undefined`.
        ...(options.ignored === undefined
          ? {}
          : { ignored: [...options.ignored,], }),
      },
    );

    /** Captured `this` for sync chokidar listeners that void-call async members with their own try/catch. */
    const self = this;

    /**
     * chokidar `ready` listener.
     * Synchronously sets the ready flag; no async work to await.
     */
    function onReady(): void {
      self.#ready = true;
      self.#logger.info('ready',);
    }

    /**
     * chokidar `add` listener.
     * Wraps `dispatchAdd` in an IIFE with internal try/catch so chokidar's
     * EventEmitter sees a sync function and rejections cannot be dropped.
     *
     * @param path - absolute path emitted by chokidar
     */
    function onAdd(path: string,): void {
      void (async function dispatchAdd(): Promise<void> {
        try {
          await self.#dispatchAddOrChange(
            'add',
            path,
          );
        }
        catch (error) {
          self.#logger.error(`add dispatch failed: ${describeError(error,)}`,);
        }
      })();
    }

    /**
     * chokidar `change` listener.
     *
     * @param path - absolute path emitted by chokidar
     */
    function onChange(path: string,): void {
      void (async function dispatchChange(): Promise<void> {
        try {
          await self.#dispatchAddOrChange(
            'change',
            path,
          );
        }
        catch (error) {
          self.#logger.error(`change dispatch failed: ${describeError(error,)}`,);
        }
      })();
    }

    /**
     * chokidar `unlink` listener.
     *
     * @param path - absolute path emitted by chokidar
     */
    function onUnlink(path: string,): void {
      void (async function dispatchUnlink(): Promise<void> {
        try {
          await self.#dispatchUnlink(path,);
        }
        catch (error) {
          self.#logger.error(`unlink dispatch failed: ${describeError(error,)}`,);
        }
      })();
    }

    /**
     * chokidar `error` listener.
     * chokidar keeps the watcher alive after recoverable errors, so this
     * does not call `stop()`.
     *
     * @param error - error value emitted by chokidar (typed `unknown` per chokidar's signature)
     */
    function onError(error: unknown,): void {
      self.#logger.error(`watcher error: ${describeError(error,)}`,);
    }

    this.#fsw.on(
      'ready',
      onReady,
    );
    this.#fsw.on(
      'add',
      onAdd,
    );
    this.#fsw.on(
      'change',
      onChange,
    );
    this.#fsw.on(
      'unlink',
      onUnlink,
    );
    this.#fsw.on(
      'error',
      onError,
    );
  }

  /**
   * Awaits chokidar's `ready` event then drains in-flight pre-populate hashes.
   * Returns immediately on subsequent calls (idempotent).
   * Resolves once the cache reflects every file present at start time.
   *
   * @example
   * ```ts
   * await watcher.untilReady();
   * // hashCache now contains an entry for every file under the watch roots
   * ```
   */
  async untilReady(): Promise<void> {
    if (!this.#ready) {
      await once(
        this.#fsw,
        'ready',
      );
    }
    while (this.#prePopulate.size > 0) {
      /* oxlint-disable-next-line eslint/no-await-in-loop -- intentional drain: each iteration awaits ALL pending pre-populates before re-checking, so the loop body cannot run concurrently */
      await Promise.allSettled(this.#prePopulate,);
    }
  }

  /**
   * Closes the chokidar watcher. Idempotent: chokidar tracks a `closed` flag
   * so calling twice does not error.
   * Resolves once chokidar has released its OS watches.
   *
   * @example
   * ```ts
   * await watcher.stop();
   * ```
   */
  async stop(): Promise<void> {
    await this.#fsw.close();
  }

  /**
   * Routes an add/change event: pre-`ready` paths feed the cache (no emit);
   * post-`ready` paths normalise and emit a {@link WatchEvent}.
   *
   * @param kind - `add` for new files, `change` for modifications
   *
   * @param path - absolute path emitted by chokidar
   */
  async #dispatchAddOrChange(
    kind: 'add' | 'change',
    path: string,
  ): Promise<void> {
    if (!this.#ready) {
      this.#trackPrePopulate(path,);
      return;
    }
    await this.#emitEvent(
      kind,
      path,
    );
  }

  /**
   * Routes an unlink event. Cache entry is dropped unconditionally so a
   * later re-create starts from a clean slate; the event is only forwarded
   * post-`ready`.
   *
   * @param path - absolute path emitted by chokidar
   */
  async #dispatchUnlink(path: string,): Promise<void> {
    this.#hashCache.delete(path,);
    if (!this.#ready)
      return;
    await this.#emitEvent(
      'unlink',
      path,
    );
  }

  /**
   * Schedules a pre-populate job and detaches its cleanup.
   *
   * @param path - absolute path to hash and store
   */
  #trackPrePopulate(path: string,): void {
    const job = this.#runPrePopulate(path,);
    this.#prePopulate.add(job,);
    void this.#drainPrePopulateJob(job,);
  }

  /**
   * Waits for a single pre-populate job to settle and removes it from the
   * tracking set. Uses `allSettled` so a rejected job still cleans up.
   *
   * @param job - the job promise to drain
   */
  async #drainPrePopulateJob(job: Promise<void>,): Promise<void> {
    await Promise.allSettled([job,],);
    this.#prePopulate.delete(job,);
  }

  /**
   * Reads a file's bytes, hashes them, stores the digest. Logs and
   * swallows errors so a single transient I/O failure does not propagate
   * up through chokidar's event dispatch.
   *
   * @param path - absolute path of the file
   */
  async #runPrePopulate(path: string,): Promise<void> {
    try {
      const hash = await this.#hashCache.hashFile(path,);
      if (hash !== null) {
        this.#hashCache.set({
          path,
          hash,
        },);
      }
    }
    catch (error) {
      this.#logger.warn(
        `pre-populate hash failed for ${path}: ${describeError(error,)}`,
      );
    }
  }

  /**
   * Normalises a chokidar event into a {@link WatchEvent} and invokes the
   * orchestrator's callback.
   *
   * @param kind - event kind
   *
   * @param path - absolute path emitted by chokidar
   */
  async #emitEvent(
    kind: WatchEventKind,
    path: string,
  ): Promise<void> {
    const root = this.#findRoot(path,);
    const event: WatchEvent = {
      kind,
      path,
      relativePath: root === undefined ? path : relative(
        root,
        path,
      ),
      ext: extname(path,),
    };
    await this.#onEvent(event,);
  }

  /**
   * Finds the deepest configured root that contains `absPath`.
   * Returns `undefined` when no root matches (chokidar should not emit
   * for such paths, but the fallback keeps the watcher defensive).
   *
   * @param absPath - absolute event path
   *
   * @returns the matching root, or `undefined` when none match
   */
  #findRoot(absPath: string,): string | undefined {
    return this.#resolvedRoots.find(function isParent(root,) {
      return isPathUnderRoot({
        root,
        absPath,
      },);
    },);
  }
}
