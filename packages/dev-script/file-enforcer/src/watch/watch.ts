import {
  join,
  resolve,
} from 'node:path';
import { invalidatePaths, } from '../io/cache.ts';
import {
  l,
  tagged,
} from '../log.ts';
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
 *
 * @example
 * ```ts
 * await startWatching('./file-enforcer.config.ts');
 * ```
 */
export function startWatching(configPath: string,): Promise<never> {
  const rl = tagged({
    tag: startWatching.name,
    l,
  },);
  /** Absolute config path for reliable comparisons */
  const absoluteConfig = resolve(configPath,);
  rl.info('watch mode started',);

  /** Active AbortControllers for each watched directory, keyed by dir path */
  const controllers = new Map<string, AbortController>();

  /** Tears down all active watchers for re-creation after a re-run. */
  function closeAllWatchers(): void {
    controllers.forEach(function abortController(controller,): void {
      controller.abort();
    },);
    controllers.clear();
  }

  /** Paths accumulated during the debounce window, invalidated together on re-run */
  const pendingPaths: Set<string> = new Set<string>();
  /** Protected paths that need notification, accumulated during the debounce window */
  const pendingProtected: Set<string> = new Set<string>();
  // Debounce state: `let` needed because the timer is replaced on each event
  let debounceTimer: ReturnType<typeof setTimeout> | undefined = undefined;

  /**
   * Re-imports the config with a cache-busting query parameter,
   * then updates the watcher set from newly tracked reads/writes.
   *
   * @param changedPaths - Absolute paths of files that triggered the re-run,
   *   invalidated from the read cache so only those files are re-read from disk
   */
  async function rerun(changedPaths: readonly string[],): Promise<void> {
    rl.info('re-running config...',);
    invalidatePaths(changedPaths,);
    reset();
    try {
      await import(`${absoluteConfig}?v=${String(Date.now(),)}`);
    }
    catch (importError: unknown) {
      rl.error(`config execution failed: ${String(importError,)}`,);
      return;
    }
    rl.info('re-run complete',);
    closeAllWatchers();
    setupWatchers();
  }

  /**
   * Handles a classified filesystem event by accumulating the changed path
   * and scheduling a debounced re-run. Multiple rapid events are coalesced
   * into a single re-run that invalidates all accumulated paths.
   *
   * @param kind - classification of the filesystem event
   *
   * @param filename - filename from the fs.watch event
   *
   * @param dir - directory the event occurred in
   */
  function handleEvent(
    kind: EventKind,
    filename: string,
    dir: string,
  ): void {
    /** Absolute path of the file that triggered this event */
    const changedPath = resolve(join(
      dir,
      filename,
    ),);
    pendingPaths.add(changedPath,);
    if (kind === 'protected')
      pendingProtected.add(changedPath,);
    clearTimeout(debounceTimer,);
    debounceTimer = setTimeout(
      function debouncedRerun(): void {
        /** Snapshot accumulated state before clearing */
        const paths = [...pendingPaths,];
        const protectedPaths = [...pendingProtected,];
        pendingPaths.clear();
        pendingProtected.clear();
        // oxlint-disable-next-line typescript/no-floating-promises -- debounced async re-run
        (async function batchRerun(): Promise<void> {
          for (const protectedPath of protectedPaths) {
            // oxlint-disable-next-line no-await-in-loop -- sequential notification to avoid spamming
            await notifyWriteProtection(protectedPath,);
          }
          await rerun(paths,);
        })();
      },
      DEBOUNCE_MS,
    );
  }

  /** Creates watchers for every directory derived from tracked reads and writes. */
  function setupWatchers(): void {
    /** Directories to watch, derived from current tracked reads + writes */
    const dirs = watchDirs(absoluteConfig,);
    rl.info(`watching ${String(dirs.size,)} directories`,);

    dirs.forEach(function setupDir(dir,): void {
      /** Per-directory abort controller for teardown */
      const controller = new AbortController();
      controllers.set(
        dir,
        controller,
      );

      // oxlint-disable-next-line typescript/no-floating-promises -- intentional fire-and-forget watcher loop
      watchDirectory(
        dir,
        controller.signal,
        absoluteConfig,
        function onWatchEvent(
          kind,
          filename,
        ): void {
          handleEvent(
            kind,
            filename,
            dir,
          );
        },
      );
    },);
  }

  setupWatchers();

  // Block forever: watch mode runs until the process is killed.
  // oxlint-disable-next-line typescript/no-empty-function -- intentional infinite block
  // oxlint-disable-next-line promise/avoid-new -- intentional infinite block requires explicit Promise
  return new Promise<never>(function neverResolve(): void {/* intentionally empty */},);
}
