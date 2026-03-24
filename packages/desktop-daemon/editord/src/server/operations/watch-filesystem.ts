/**
 * Directory-scoped filesystem watcher for editord.
 *
 * Watches individual directories (not recursive) using `fs.watch`.
 * Debounces rapid events and filters noise from temporary files.
 * Only directories explicitly registered via {@link DirWatcher.watchDir}
 * get watched — typically directories the user has expanded in the tree.
 */

import {
  type FSWatcher,
  watch,
} from 'node:fs';
import { stat, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { FsChangeType, } from '../../protocol.ts';
import {
  type Logger,
  tagged,
} from '../log.ts';
import {
  DEBOUNCE_MS,
  isIgnored,
  SUPPRESS_MS,
} from './watch-filesystem-filter.ts';

/** Structured filesystem change event emitted after debounce and resolution. */
export type FsChangeEvent = {
  /** Absolute path of the changed entry. */
  path: string;
  /** Category of the change. */
  changeType: FsChangeType;
  /** Whether the changed entry is a directory. */
  isDirectory: boolean;
};

/**
 * Manages per-directory `fs.watch` instances.
 *
 * Each watched directory gets one non-recursive watcher.
 * Raw events are debounced per-path, filtered for noise,
 * and resolved via `stat` to determine the change category.
 */
export class DirWatcher {
  /** Active watchers keyed by directory path. */
  #watchers = new Map<string, FSWatcher>();

  /** Pending debounced events keyed by full path of the changed entry. */
  #pending = new Map<string,
    { timer: ReturnType<typeof setTimeout>; eventType: string; }>();

  /** Paths suppressed from emitting events (e.g. after a self-save). */
  #suppressed = new Set<string>();

  /** Callback invoked for each resolved change event. */
  #onChange: (event: FsChangeEvent,) => void;

  /** Tagged logger. */
  #l: Logger;

  /**
   * @param onChange - callback invoked for each debounced, filtered change event
   *
   * @param l - parent logger for tag composition
   */
  constructor(
    { onChange, l, }: { onChange: (event: FsChangeEvent,) => void; l: Logger; },
  ) {
    this.#onChange = onChange;
    this.#l = tagged({ tag: 'watcher', l, },);
  }

  /**
   * Starts watching a directory for changes. No-op if already watched.
   *
   * @param path - absolute path of the directory to watch
   */
  watchDir({ path, }: { path: string; },): void {
    if (this.#watchers.has(path,))
      return;

    const self = this;
    try {
      const fsWatcher = watch(path, function handleWatchEvent(eventType, filename,) {
        if (typeof filename !== 'string')
          return;
        if (isIgnored({ name: filename, },))
          return;
        self.#schedule({ dirPath: path, filename, eventType, },);
      },);

      fsWatcher.on('error', function handleWatchError(error,) {
        self.#l.error(`watcher error for ${path}: ${String(error,)}`,);
        self.#removeWatcher({ path, },);
      },);

      this.#watchers.set(path, fsWatcher,);
      this.#l.info(`watching: ${path}`,);
    }
    catch (error) {
      this.#l.error(`failed to watch ${path}: ${String(error,)}`,);
    }
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
    globalThis.setTimeout(function clearSuppression() {
      self.#suppressed.delete(path,);
    }, SUPPRESS_MS,);
  }

  /** Closes all watchers and cancels pending debounce timers. */
  close(): void {
    for (const fsWatcher of this.#watchers.values())
      fsWatcher.close();
    this.#watchers.clear();

    for (const entry of this.#pending.values())
      clearTimeout(entry.timer,);
    this.#pending.clear();
    this.#suppressed.clear();
  }

  /**
   * Debounces a raw filesystem event. Coalesces rapid events for the same
   * path within {@link DEBOUNCE_MS}, keeping the latest event type.
   *
   * @param dirPath - watched directory path
   *
   * @param filename - name of the changed entry within the directory
   *
   * @param eventType - raw event type from `fs.watch` ('rename' or 'change')
   */
  #schedule({ dirPath, filename, eventType, }: {
    dirPath: string;
    filename: string;
    eventType: string;
  },): void {
    const fullPath = join(dirPath, filename,);
    if (this.#suppressed.has(fullPath,))
      return;

    const existing = this.#pending.get(fullPath,);
    if (existing !== undefined)
      clearTimeout(existing.timer,);

    const self = this;
    const timer = globalThis.setTimeout(function emitDebounced() {
      self.#pending.delete(fullPath,);
      void self.#resolveAndEmit({ fullPath, eventType, },);
    }, DEBOUNCE_MS,);

    this.#pending.set(fullPath, { timer, eventType, },);
  }

  /**
   * Resolves a debounced event into a structured change event via `stat`.
   *
   * - `'change'` event type maps to `'modified'` (content change)
   * - `'rename'` + file exists maps to `'created'`
   * - `'rename'` + file gone maps to `'deleted'`
   *
   * @param fullPath - absolute path of the changed entry
   *
   * @param eventType - raw event type from `fs.watch`
   */
  async #resolveAndEmit({ fullPath, eventType, }: {
    fullPath: string;
    eventType: string;
  },): Promise<void> {
    if (eventType === 'change') {
      this.#onChange({ path: fullPath, changeType: 'modified', isDirectory: false, },);
      return;
    }

    /** Rename event: stat to determine created vs deleted. */
    try {
      const stats = await stat(fullPath,);
      this.#onChange({ path: fullPath, changeType: 'created', isDirectory: stats
        .isDirectory(), },);
    }
    catch {
      this.#onChange({ path: fullPath, changeType: 'deleted', isDirectory: false, },);
    }
  }

  /**
   * Removes and closes a single directory watcher.
   *
   * @param path - directory path to stop watching
   */
  #removeWatcher({ path, }: { path: string; },): void {
    const fsWatcher = this.#watchers.get(path,);
    if (fsWatcher !== undefined) {
      fsWatcher.close();
      this.#watchers.delete(path,);
    }
  }
}
