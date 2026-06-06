import { stat, } from 'node:fs/promises';
import { relative, } from 'node:path';
import type { FSWatcher, } from 'chokidar';

import type { EventKind, } from './watch-filter.ts';

/**
 * Arguments accepted by watchDirectory.
 */
export type WatchDirectoryOptions = Readonly<{
  /**
   * Absolute directory path to watch.
   */
  dir: string;

  /**
   * AbortSignal for teardown.
   */
  signal: AbortSignal;

  /**
   * Absolute config path for event classification.
   */
  configPath: string;

  /**
   * Callback receiving event classification and changed filename relative to {@link dir}.
   */
  onEvent: (
    kind: EventKind,
    filename: string,
  ) => void;
}>;

/**
 * Settled state marker for one chokidar watcher promise.
 */
export type WatchDirectorySettledState = Map<'settled', true>;

/**
 * Completion resolver pair for one watch loop.
 */
export type WatchDirectoryCompletion = ReturnType<typeof Promise.withResolvers<void>>;

/**
 * Verifies that chokidar is being asked to watch an existing directory.
 *
 * Chokidar can silently treat missing paths as future paths. File-enforcer's
 * restart supervisor depends on setup failures rejecting, so this explicit
 * check preserves the previous `fs.watch` failure contract.
 *
 * @param dir - Absolute directory path to validate.
 *
 * @throws When metadata lookup fails or `dir` is not a directory.
 *
 * @example
 * ```ts
 * await assertExistingWatchDirectory({ dir: '/repo/src' });
 * ```
 */
export async function assertExistingWatchDirectory(
  { dir, }: { readonly dir: string; },
): Promise<void> {
  /**
   * Filesystem metadata for watched root.
   */
  const dirStat = await stat(dir,);
  if (dirStat.isDirectory())
    return;

  throw new Error(`watch root is not a directory: ${dir}`,);
}

/**
 * Returns whether one watchDirectory completion path already settled.
 *
 * @param settledState - Single-key holder for settled state.
 *
 * @returns Whether completion was already resolved or rejected.
 *
 * @example
 * ```ts
 * const done = watchDirectoryAlreadySettled({ settledState });
 * ```
 */
function watchDirectoryAlreadySettled(
  { settledState, }: { readonly settledState: ReadonlyMap<'settled', true>; },
): boolean {
  return settledState.has('settled',);
}

/**
 * Marks a watcher completion as settled if it was still pending.
 *
 * @param settledState - Mutable single-key settled-state holder.
 *
 * @returns Whether this call won the settlement race.
 *
 * @example
 * ```ts
 * const first = settleWatchDirectoryOnce({ settledState });
 * ```
 */
function settleWatchDirectoryOnce(
  { settledState, }: { readonly settledState: WatchDirectorySettledState; },
): boolean {
  if (watchDirectoryAlreadySettled({ settledState, },))
    return false;

  settledState.set(
    'settled',
    true,
  );
  return true;
}

/**
 * Converts chokidar's emitted path into the filename shape expected by
 * classifyEvent and existing watchDirectory callers.
 *
 * @param dir - Watched directory root.
 *
 * @param path - Path emitted by chokidar.
 *
 * @returns Path relative to `dir`, or `.` for the watched root itself.
 *
 * @example
 * ```ts
 * const filename = filenameForChokidarPath({ dir: '/repo/src', path: '/repo/src/a.ts' });
 * ```
 */
export function filenameForChokidarPath(
  {
    dir,
    path,
  }: {
    readonly dir: string;
    readonly path: string;
  },
): string {
  /**
   * Relative event path preserving nested child paths under the watched root.
   */
  const filename = relative(
    dir,
    path,
  );
  if (filename === '')
    return '.';

  return filename;
}

/**
 * Closes an active chokidar watcher, returning any close failure to the caller.
 *
 * @param watcher - Chokidar watcher to close, if setup reached creation.
 *
 * @returns Close failure, or `undefined` after a clean close.
 *
 * @example
 * ```ts
 * const closeError = await closeActiveWatcher({ watcher });
 * ```
 */
async function closeActiveWatcher(
  { watcher, }: { readonly watcher: FSWatcher | undefined; },
): Promise<unknown | undefined> {
  if (watcher === undefined)
    return undefined;

  try {
    await watcher.close();
  }
  catch (closeError: unknown) {
    return closeError;
  }

  return undefined;
}

/**
 * Resolves watch completion after closing chokidar for normal abort teardown.
 *
 * @param completion - Resolver pair awaited by watchDirectory.
 *
 * @param settledState - Single-key state preventing double settlement.
 *
 * @param watcher - Active chokidar watcher.
 *
 * @example
 * ```ts
 * await resolveWatchDirectoryAfterClose({ completion, settledState, watcher });
 * ```
 */
export async function resolveWatchDirectoryAfterClose(
  {
    completion,
    settledState,
    watcher,
  }: {
    readonly completion: WatchDirectoryCompletion;
    readonly settledState: WatchDirectorySettledState;
    readonly watcher: FSWatcher | undefined;
  },
): Promise<void> {
  if (!settleWatchDirectoryOnce({ settledState, },))
    return;

  /**
   * Any failure while closing chokidar during normal teardown.
   */
  const closeError = await closeActiveWatcher({ watcher, },);
  if (closeError === undefined) {
    completion.resolve();
    return;
  }

  completion.reject(closeError,);
}

/**
 * Rejects watch completion after closing chokidar for watcher failure paths.
 *
 * @param completion - Resolver pair awaited by watchDirectory.
 *
 * @param settledState - Single-key state preventing double settlement.
 *
 * @param watcher - Active chokidar watcher.
 *
 * @param watchError - Failure that should reject the watch loop.
 *
 * @example
 * ```ts
 * await rejectWatchDirectoryAfterClose({ completion, settledState, watcher, watchError });
 * ```
 */
export async function rejectWatchDirectoryAfterClose(
  {
    completion,
    settledState,
    watcher,
    watchError,
  }: {
    readonly completion: WatchDirectoryCompletion;
    readonly settledState: WatchDirectorySettledState;
    readonly watcher: FSWatcher | undefined;
    readonly watchError: unknown;
  },
): Promise<void> {
  if (!settleWatchDirectoryOnce({ settledState, },))
    return;

  /**
   * Any failure while closing chokidar after the original watcher failure.
   */
  const closeError = await closeActiveWatcher({ watcher, },);
  completion.reject(closeError
    ?? watchError,);
}
