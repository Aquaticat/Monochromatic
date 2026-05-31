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
  isEditordTempFile,
  isIgnored,
  SUPPRESS_MS,
} from './watch-filesystem-filter.ts';

/**
 * Structured filesystem change event emitted to the watcher's consumer.
 */
export type FsChangeEvent = {
  /**
   * Absolute path of the changed entry.
   */
  readonly path: string;
  /**
   * Category of the change.
   */
  readonly changeType: FsChangeType;
  /**
   * Whether the changed entry is a directory.
   */
  readonly isDirectory: boolean;
};

/**
 * Options for {@link createDirWatcher}.
 */
export type DirWatcherOptions = {
  /**
   * Callback invoked for each resolved change event.
   */
  readonly onChange: (event: FsChangeEvent,) => void;
  /**
   * Parent logger for tag composition.
   */
  readonly l: Logger;
};

/**
 * Directory watcher handle returned by {@link createDirWatcher}.
 */
export type DirWatcher = Readonly<{
  /**
   * Starts watching a directory for changes.
   */
  readonly watchDir: (event: { readonly path: string; },) => void;
  /**
   * Temporarily suppresses change events for a file path.
   */
  readonly suppressPath: (event: { readonly path: string; },) => void;
  /**
   * Closes all watchers.
   */
  readonly close: () => Promise<void>;
}>;

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
    readonly path: string;
    readonly l: Logger;
  },
): Promise<void> {
  try {
    /**
     * Snapshot of directory contents prior to filtering for stale temp files.
     */
    const entries = await readdir(path,);
    /**
     * Stale temp files left over from interrupted writes; subset of `entries`.
     */
    const orphans = entries.filter(
      function isOrphan(name,): boolean {
        return isEditordTempFile(name,);
      },
    );
    if (orphans.length
      === 0)
      return;
    /**
     * Settled results so a single unlink failure does not mask the rest.
     */
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
    /**
     * Rejected promises only; surfaced in the warn branch below.
     */
    const failed = results.filter(
      function isRejection(r,): boolean {
        return r.status
          === 'rejected';
      },
    );
    if (failed.length
      > 0) {
      l.warn(
        `orphan sweep: ${String(failed.length,)}/${
          String(orphans.length,)
        } unlinks failed in ${path}`,
      );
    }
    else {
      l.info(`orphan sweep: cleaned ${String(orphans.length,)} temp file(s) in ${path}`,);
    }
  }
  catch (sweepError) {
    l.warn(`orphan sweep failed for ${path}: ${String(sweepError,)}`,);
  }
}

/**
 * Creates a per-directory chokidar watcher manager.
 *
 * Each watched directory gets one `depth: 0` chokidar instance. Raw chokidar
 * events are filtered through the suppression set for self-triggered saves
 * and categorised into {@link FsChangeEvent}s before reaching the consumer.
 *
 * @param onChange - callback invoked for each filtered change event
 *
 * @param l - parent logger for tag composition
 *
 * @returns frozen directory watcher handle
 *
 * @example
 * ```ts
 * const watcher = createDirWatcher({
 *   onChange: function handleChange(event) { console.info(event.path); },
 *   l: logger,
 * });
 * watcher.watchDir({ path: '/home/user/project/src', });
 * ```
 */
export function createDirWatcher(
  {
    onChange,
    l,
  }: DirWatcherOptions,
): DirWatcher {
  /**
   * Active watchers keyed by directory path.
   */
  const watchers = new Map<string, FSWatcher>();
  /**
   * Paths suppressed from emitting events (e.g. after a self-save).
   */
  const suppressed = new Set<string>();
  /**
   * Tagged logger.
   */
  const logger = tagged({
    tag: 'watcher',
    l,
  },);

  /**
   * Removes and closes a single directory watcher (best-effort on error).
   *
   * @param path - directory path to stop watching
   */
  function removeWatcher({ path, }: { readonly path: string; },): void {
    /**
     * Already-removed watcher returns silently rather than throwing.
     */
    const fsWatcher = watchers.get(path,);
    if (fsWatcher === undefined)
      return;
    watchers.delete(path,);
    void fsWatcher.close();
  }

  /**
   * Wires chokidar lifecycle and event listeners for a single watcher.
   * Each listener is a named function declaration; events the watcher would
   * otherwise echo back to the client are dropped against `suppressed`.
   *
   * @param fsWatcher - the constructed chokidar watcher
   *
   * @param path - directory path this watcher is responsible for
   */
  function wireEvents(
    {
      fsWatcher,
      path,
    }: {
      readonly fsWatcher: FSWatcher;
      readonly path: string;
    },
  ): void {
    /**
     * Emits a change event after suppression check.
     */
    function emit(
      {
        eventPath,
        changeType,
        isDirectory,
      }: {
        readonly eventPath: string;
        readonly changeType: FsChangeType;
        readonly isDirectory: boolean;
      },
    ): void {
      if (suppressed.has(eventPath,))
        return;
      onChange({
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
        logger.error(`watcher error for ${path}: ${String(error,)}`,);
        removeWatcher({ path, },);
      },
    );
  }

  /**
   * Starts watching a directory for changes. No-op if already watched.
   * Triggers a background orphan-temp sweep on first registration.
   *
   * @param path - absolute path of the directory to watch
   */
  function watchDir({ path, }: { readonly path: string; },): void {
    if (watchers.has(path,))
      return;

    /**
     * Per-directory chokidar instance; depth 0 keeps the watch shallow.
     */
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

    wireEvents({
      fsWatcher,
      path,
    },);

    watchers.set(
      path,
      fsWatcher,
    );
    logger.info(`watching: ${path}`,);

    /**
     * Run the orphan sweep concurrently with watcher startup. With
     * `ignoreInitial: true` and the `~$` ignore rule, neither the
     * pre-existing temp files nor their unlinks emit events.
     */
    void sweepOrphanTemps({
      path,
      l: logger,
    },);
  }

  /**
   * Temporarily suppresses change events for a file path.
   * Used after saving a file from the editor to avoid self-triggered reloads.
   *
   * @param path - absolute file path to suppress
   */
  function suppressPath({ path, }: { readonly path: string; },): void {
    suppressed.add(path,);
    globalThis.setTimeout(
      function clearSuppression() {
        suppressed.delete(path,);
      },
      SUPPRESS_MS,
    );
  }

  /**
   * Closes all watchers.
   */
  async function close(): Promise<void> {
    /**
     * Settled together so one failed watcher close does not block the others.
     */
    const closes = [...watchers.values(),].map(
      function closeOne(w,) {
        return w.close();
      },
    );
    watchers.clear();
    suppressed.clear();
    await Promise.allSettled(closes,);
  }

  return Object.freeze({
    watchDir,
    suppressPath,
    close,
  },);
}
