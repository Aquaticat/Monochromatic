import {
  join,
  resolve,
} from 'node:path';
import { invalidatePaths, } from '../io/cache.ts';
import { reset, } from '../tracker.ts';
import { notifyWriteProtection, } from './notify.ts';
import {
  DEBOUNCE_MS,
  watchDirectory,
} from './watch-dir.ts';
import {
  type EventKind,
  watchDirs,
} from './watch-filter.ts';

/**
 * Watches source files and managed destinations, re-executing the config
 * on source changes and reverting + notifying on external destination edits.
 *
 * This function never returns under normal operation (it loops forever watching).
 *
 * @param configPath - Path to the file-enforcer config file
 */
export function startWatching(configPath: string,): Promise<never> {
  /** Absolute config path for reliable comparisons */
  const absoluteConfig = resolve(configPath,);
  console.log('[file-enforcer] watch mode started',);

  /** Active AbortControllers for each watched directory, keyed by dir path */
  const controllers = new Map<string, AbortController>();

  /** Tears down all active watchers for re-creation after a re-run. */
  function closeAllWatchers(): void {
    controllers.forEach(function abortController(controller,): void {
      controller.abort();
    },);
    controllers.clear();
  }

  // Debounce state -- `let` needed because the timer is replaced on each event
  let debounceTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  /**
   * Re-imports the config with a cache-busting query parameter,
   * then updates the watcher set from newly tracked reads/writes.
   *
   * @param changedPath - Absolute path of the file that triggered the re-run,
   *   invalidated from the read cache so only that file is re-read from disk
   */
  async function rerun(changedPath: string,): Promise<void> {
    console.log('[file-enforcer] re-running config...',);
    invalidatePaths([changedPath,],);
    reset();
    try {
      await import(`${absoluteConfig}?v=${String(Date.now(),)}`);
    }
    catch (importError: unknown) {
      console.error('[file-enforcer] config execution failed:', importError,);
      return;
    }
    console.log('[file-enforcer] re-run complete',);
    closeAllWatchers();
    setupWatchers();
  }

  /**
   * Handles a classified filesystem event by either scheduling a
   * normal re-run (source) or a re-run with notification (protected).
   *
   * @param kind - classification of the filesystem event
   *
   * @param filename - filename from the fs.watch event
   *
   * @param dir - directory the event occurred in
   */
  function handleEvent(kind: EventKind, filename: string, dir: string,): void {
    /** Absolute path of the file that triggered this event */
    const changedPath = resolve(join(dir, filename,),);
    clearTimeout(debounceTimer,);
    if (kind === 'protected') {
      debounceTimer = setTimeout(function protectedRerun(): void {
        // oxlint-disable-next-line typescript/no-floating-promises -- debounced async protection
        (async function notifyAndRerun(): Promise<void> {
          await notifyWriteProtection(changedPath,);
          await rerun(changedPath,);
        })();
      }, DEBOUNCE_MS,);
      return;
    }
    debounceTimer = setTimeout(function sourceRerun(): void {
      // oxlint-disable-next-line typescript/no-floating-promises -- debounced async re-run
      rerun(changedPath,);
    }, DEBOUNCE_MS,);
  }

  /** Creates watchers for every directory derived from tracked reads and writes. */
  function setupWatchers(): void {
    /** Directories to watch, derived from current tracked reads + writes */
    const dirs = watchDirs(absoluteConfig,);
    console.log(`[file-enforcer] watching ${String(dirs.size,)} directories`,);

    dirs.forEach(function setupDir(dir,): void {
      /** Per-directory abort controller for teardown */
      const controller = new AbortController();
      controllers.set(dir, controller,);

      // oxlint-disable-next-line typescript/no-floating-promises -- intentional fire-and-forget watcher loop
      watchDirectory(dir, controller.signal, absoluteConfig,
        function onWatchEvent(kind, filename,): void {
          handleEvent(kind, filename, dir,);
        },);
    },);
  }

  setupWatchers();

  // Block forever -- watch mode runs until the process is killed.
  // oxlint-disable-next-line typescript/no-empty-function -- intentional infinite block
  // oxlint-disable-next-line promise/avoid-new -- intentional infinite block requires explicit Promise
  return new Promise<never>(function neverResolve(): void {/* intentionally empty */},);
}
