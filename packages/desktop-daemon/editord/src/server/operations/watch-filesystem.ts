/**
 * Directory-scoped filesystem watcher for editord.
 *
 * Watches individual directories (not recursive) using `chokidar`. Each
 * registered directory gets its own watcher with `depth: 0`, matching the
 * file-tree UI's lazy-loading model: directories the user has not expanded
 * never need watching, and the daemon avoids walking `node_modules`,
 * `.git`, or build-output trees that whole-root recursive watching would
 * pull in.
 *
 * On first registration of a directory, orphaned editord atomic-write temp
 * files left over by a SIGKILL of a previous daemon are swept (best-effort,
 * concurrent with watcher startup). The sweep is bounded by the directory's
 * own entries; it does not recurse.
 *
 * `chokidar` already handles event debouncing (`awaitWriteFinish`),
 * external editor atomic-save detection (`atomic`), and `add`/`change`/
 * `unlink` event categorisation, so this wrapper is a thin adapter that
 * preserves the editord-specific public API (`watchDir`, `suppressPath`,
 * `close`, `FsChangeEvent`).
 */

import {
  type FSWatcher,
  watch as chokidarWatch,
} from 'chokidar';
import {
  readdir,
  unlink,
} from 'node:fs/promises';
import {
  basename,
  join,
} from 'node:path';

import type { FsChangeType, } from '../../protocol.ts';
import {
  type Logger,
  tagged,
} from '../log.ts';
import {
  AWAIT_WRITE_FINISH_MS,
  AWAIT_WRITE_FINISH_POLL_MS,
  EDITORD_TEMP_PATTERN,
  isIgnored,
  SUPPRESS_MS,
} from './watch-filesystem-filter.ts';

/** Structured filesystem change event emitted to the watcher's consumer. */
export type FsChangeEvent = {
  /** Absolute path of the changed entry. */
  path: string;
  /** Category of the change. */
  changeType: FsChangeType;
  /** Whether the changed entry is a directory. */
  isDirectory: boolean;
};

/**
 * Adapts a chokidar `ignored` predicate to editord's basename-level
 * `isIgnored` rule. chokidar passes the full path; we match against the
 * basename so the existing `IGNORED_NAMES`/`IGNORED_PATTERN` semantics
 * keep working.
 *
 * @param path - absolute path candidate
 *
 * @returns true when chokidar should skip the path entirely
 *
 * @example
 * ```ts
 * const skip = chokidarIgnored('/proj/.git');
 * ```
 */
function chokidarIgnored(path: string,): boolean {
  return isIgnored({ name: basename(path,), },);
}

/**
 * Best-effort sweep of orphaned editord atomic-write temp files in one
 * directory. Runs on first registration so any leftovers from a
 * `SIGKILL`'d previous run are cleaned up the next time the user opens
 * that directory in the tree.
 *
 * Errors are logged but never thrown: the watcher should come up even if
 * the sweep fails, and chokidar's `ignored` predicate already filters
 * surviving temp files from the event stream.
 *
 * @param path - absolute directory to sweep
 *
 * @param l - tagged logger for diagnostic output
 */
async function sweepOrphanTemps(
  {
    path,
    l,
  }: {
    path: string;
    l: Logger;
  },
): Promise<void> {
  try {
    const entries = await readdir(path,);
    const orphans = entries.filter(
      function isOrphan(name,): boolean {
        return EDITORD_TEMP_PATTERN.test(name,);
      },
    );
    if (orphans.length === 0)
      return;
    const results = await Promise.allSettled(
      orphans.map(
        function removeOrphan(name,): Promise<void> {
          return unlink(
            join(
              path,
              name,
            ),
          );
        },
      ),
    );
    const failed = results.filter(
      function isRejection(r,): boolean {
        return r.status === 'rejected';
      },
    );
    if (failed.length > 0)
      l.warn(`orphan sweep: ${String(failed.length,)}/${String(orphans.length,)} unlinks failed in ${path}`,);
    else
      l.info(`orphan sweep: cleaned ${String(orphans.length,)} temp file(s) in ${path}`,);
  }
  catch (sweepError) {
    l.warn(`orphan sweep failed for ${path}: ${String(sweepError,)}`,);
  }
}

/**
 * Manages per-directory chokidar watchers.
 *
 * Each watched directory gets one `depth: 0` chokidar instance. Raw chokidar
 * events are filtered through `#suppressed` (for self-triggered saves) and
 * categorised into {@link FsChangeEvent}s before reaching the consumer.
 */
export class DirWatcher {
  /** Active watchers keyed by directory path. */
  readonly #watchers = new Map<string, FSWatcher>();

  /** Paths suppressed from emitting events (e.g. after a self-save). */
  readonly #suppressed = new Set<string>();

  /** Callback invoked for each resolved change event. */
  readonly #onChange: (event: FsChangeEvent,) => void;

  /** Tagged logger. */
  readonly #l: Logger;

  /**
   * @param onChange - callback invoked for each filtered change event
   *
   * @param l - parent logger for tag composition
   */
  constructor(
    {
      onChange,
      l,
    }: {
      onChange: (event: FsChangeEvent,) => void;
      l: Logger;
    },
  ) {
    this.#onChange = onChange;
    this.#l = tagged({
      tag: 'watcher',
      l,
    },);
  }

  /**
   * Starts watching a directory for changes. No-op if already watched.
   * Triggers a background orphan-temp sweep on first registration.
   *
   * @param path - absolute path of the directory to watch
   */
  watchDir({ path, }: { path: string; },): void {
    if (this.#watchers.has(path,))
      return;

    const fsWatcher = chokidarWatch(
      path,
      {
        atomic: true,
        awaitWriteFinish: {
          stabilityThreshold: AWAIT_WRITE_FINISH_MS,
          pollInterval: AWAIT_WRITE_FINISH_POLL_MS,
        },
        depth: 0,
        ignoreInitial: true,
        persistent: true,
        followSymlinks: false,
        ignored: chokidarIgnored,
      },
    );

    this.#wireEvents({
      fsWatcher,
      path,
    },);

    this.#watchers.set(
      path,
      fsWatcher,
    );
    this.#l.info(`watching: ${path}`,);

    /**
     * Run the orphan sweep concurrently with watcher startup. With
     * `ignoreInitial: true` and the `~$` ignore rule, neither the
     * pre-existing temp files nor their unlinks emit events.
     */
    void sweepOrphanTemps({
      path,
      l: this.#l,
    },);
  }

  /**
   * Temporarily suppresses change events for a file path.
   * Used after saving a file from the editor to avoid self-triggered reloads.
   *
   * @param path - absolute file path to suppress
   */
  suppressPath({ path, }: { path: string; },): void {
    const self = this;
    self.#suppressed.add(path,);
    globalThis.setTimeout(
      function clearSuppression() {
        self.#suppressed.delete(path,);
      },
      SUPPRESS_MS,
    );
  }

  /** Closes all watchers. */
  async close(): Promise<void> {
    const closes = [...this.#watchers.values(),].map(
      function closeOne(w,) {
        return w.close();
      },
    );
    this.#watchers.clear();
    this.#suppressed.clear();
    await Promise.allSettled(closes,);
  }

  /**
   * Wires chokidar lifecycle and event listeners for a single watcher.
   * Each listener is a named function declaration; events the watcher would
   * otherwise echo back to the client are dropped against `#suppressed`.
   *
   * @param fsWatcher - the constructed chokidar watcher
   *
   * @param path - directory path this watcher is responsible for
   */
  #wireEvents(
    {
      fsWatcher,
      path,
    }: {
      fsWatcher: FSWatcher;
      path: string;
    },
  ): void {
    const self = this;

    /**
     * Emits a change event after suppression check.
     */
    function emit(
      {
        eventPath,
        changeType,
        isDirectory,
      }: {
        eventPath: string;
        changeType: FsChangeType;
        isDirectory: boolean;
      },
    ): void {
      if (self.#suppressed.has(eventPath,))
        return;
      self.#onChange({
        path: eventPath,
        changeType,
        isDirectory,
      },);
    }

    fsWatcher.on(
      'add',
      function handleAdd(eventPath,) {
        emit({
          eventPath,
          changeType: 'created',
          isDirectory: false,
        },);
      },
    );
    fsWatcher.on(
      'addDir',
      function handleAddDir(eventPath,) {
        emit({
          eventPath,
          changeType: 'created',
          isDirectory: true,
        },);
      },
    );
    fsWatcher.on(
      'change',
      function handleChange(eventPath,) {
        emit({
          eventPath,
          changeType: 'modified',
          isDirectory: false,
        },);
      },
    );
    fsWatcher.on(
      'unlink',
      function handleUnlink(eventPath,) {
        emit({
          eventPath,
          changeType: 'deleted',
          isDirectory: false,
        },);
      },
    );
    fsWatcher.on(
      'unlinkDir',
      function handleUnlinkDir(eventPath,) {
        emit({
          eventPath,
          changeType: 'deleted',
          isDirectory: true,
        },);
      },
    );
    fsWatcher.on(
      'error',
      function handleWatchError(error,) {
        self.#l.error(`watcher error for ${path}: ${String(error,)}`,);
        self.#removeWatcher({ path, },);
      },
    );
  }

  /**
   * Removes and closes a single directory watcher (best-effort on error).
   *
   * @param path - directory path to stop watching
   */
  #removeWatcher({ path, }: { path: string; },): void {
    const fsWatcher = this.#watchers.get(path,);
    if (fsWatcher === undefined)
      return;
    this.#watchers.delete(path,);
    void fsWatcher.close();
  }
}
