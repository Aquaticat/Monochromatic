import {
  join,
  resolve,
} from 'node:path';
import { reset, } from './tracker.ts';
import { notifyWriteProtection, } from './notify.ts';
import { DEBOUNCE_MS, watchDirectory, } from './watch-dir.ts';
import { watchDirs, } from './watch-filter.ts';
import type { EventKind, } from './watch-filter.ts';

/**
 * Watches source files and managed destinations, re-executing the config
 * on source changes and reverting + notifying on external destination edits.
 *
 * This function never returns under normal operation (it loops forever watching).
 * @param configPath - Path to the file-enforcer config file
 */
export async function startWatching(configPath: string): Promise<never> {
  /** Absolute config path for reliable comparisons */
  const absoluteConfig = resolve(configPath);
  console.log('[file-enforcer] watch mode started');

  /** Active AbortControllers for each watched directory, keyed by dir path */
  const controllers = new Map<string, AbortController>();

  /** Tears down all active watchers for re-creation after a re-run. */
  function closeAllWatchers(): void {
    controllers.forEach((controller) => controller.abort());
    controllers.clear();
  }

  // Debounce state -- `let` needed because the timer is replaced on each event
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  /**
   * Re-imports the config with a cache-busting query parameter,
   * then updates the watcher set from newly tracked reads/writes.
   */
  async function rerun(): Promise<void> {
    console.log('[file-enforcer] re-running config...');
    reset();
    try {
      await import(`${absoluteConfig}?v=${String(Date.now())}`);
    } catch (importError: unknown) {
      console.error('[file-enforcer] config execution failed:', importError);
      return;
    }
    console.log('[file-enforcer] re-run complete');
    closeAllWatchers();
    setupWatchers();
  }

  /**
   * Handles a classified filesystem event by either scheduling a
   * normal re-run (source) or a re-run with notification (protected).
   */
  function handleEvent(kind: EventKind, filename: string, dir: string): void {
    clearTimeout(debounceTimer);
    if (kind === 'protected') {
      /** Absolute path of the externally modified managed file */
      const protectedPath = resolve(join(dir, filename));
      debounceTimer = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises -- debounced async protection
        (async (): Promise<void> => {
          await notifyWriteProtection(protectedPath);
          await rerun();
        })();
      }, DEBOUNCE_MS);
      return;
    }
    debounceTimer = setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- debounced async re-run
      rerun();
    }, DEBOUNCE_MS);
  }

  /** Creates watchers for every directory derived from tracked reads and writes. */
  function setupWatchers(): void {
    /** Directories to watch, derived from current tracked reads + writes */
    const dirs = watchDirs(absoluteConfig);
    console.log(`[file-enforcer] watching ${String(dirs.size)} directories`);

    dirs.forEach((dir) => {
      /** Per-directory abort controller for teardown */
      const controller = new AbortController();
      controllers.set(dir, controller);

      // eslint-disable-next-line @typescript-eslint/no-floating-promises -- intentional fire-and-forget watcher loop
      watchDirectory(dir, controller.signal, absoluteConfig, (kind, filename) => {
        handleEvent(kind, filename, dir);
      });
    });
  }

  setupWatchers();

  // Block forever -- watch mode runs until the process is killed.
  // eslint-disable-next-line @typescript-eslint/no-empty-function -- intentional infinite block
  return await new Promise<never>(() => {});
}
