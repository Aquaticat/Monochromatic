import { resolve, } from 'node:path';

//region Private mutable collections

/**
 * Internal mutable set of files read during config execution.
 * Exposed publicly as a {@link ReadonlySet} to prevent external mutation
 * that could bypass path normalization or break invariants.
 */
const _reads: Set<string> = new Set<string>();

/**
 * Internal mutable set of managed destination files.
 * Exposed publicly as a {@link ReadonlySet}.
 */
const _writes: Set<string> = new Set<string>();

/**
 * Internal mutable map of write timestamps for echo suppression.
 * Exposed publicly as a {@link ReadonlyMap}.
 */
const _writeTimestamps: Map<string, number> = new Map<string, number>();

//endregion Private mutable collections

//region Read-only public views

/**
 * Absolute paths of files read during config execution.
 * Populated by `cat()` as a side effect so watch mode knows what to monitor.
 * Read-only -- use {@link trackRead} or {@link addWatchedPaths} to add entries.
 */
export const reads: ReadonlySet<string> = _reads;

/**
 * Absolute paths of all managed destination files.
 * Populated by `overwrite()` / `overwriteEach()` even when content
 * is unchanged and the actual write is skipped.
 * Read-only -- use {@link trackDest} to add entries.
 */
export const writes: ReadonlySet<string> = _writes;

/**
 * Timestamps (ms since epoch) of actual file writes, keyed by absolute path.
 * Only populated when content was different and a real write occurred.
 * Used by `classifyEvent` to distinguish our write echoes from external edits
 * by comparing against the file's mtime.
 * Read-only -- use {@link trackWriteTime} or {@link setWriteTimestamp} to add entries.
 */
export const writeTimestamps: ReadonlyMap<string, number> = _writeTimestamps;

//endregion Read-only public views

//region Mutation functions

/**
 * Clears tracking state between watch-mode re-runs so stale paths
 * from a previous execution don't linger.
 * Preserves `writeTimestamps` because echo detection needs to survive across re-runs.
 */
export function reset(): void {
  _reads.clear();
  _writes.clear();
}

/**
 * Clears all write timestamps.
 * Primarily for test cleanup -- production watch mode preserves timestamps
 * across re-runs via {@link reset} which intentionally skips this collection.
 */
export function resetWriteTimestamps(): void {
  _writeTimestamps.clear();
}

/**
 * Records a read path, resolving to absolute for reliable watch comparisons.
 *
 * @param filePath - path to register as a tracked read
 */
export function trackRead(filePath: string,): void {
  _reads.add(resolve(filePath,),);
}

/**
 * Registers a path as a managed destination without recording a write timestamp.
 * Called unconditionally in write functions so watch mode knows to protect the
 * file, even when content was unchanged and the actual write was skipped.
 *
 * @param filePath - path to register as a managed destination
 */
export function trackDest(filePath: string,): void {
  _writes.add(resolve(filePath,),);
}

/**
 * Records the timestamp of an actual file write for echo suppression.
 * Must be called **after** the write completes so the file's mtime
 * is guaranteed to be \<= the recorded timestamp.
 *
 * @param filePath - path that was just written
 */
export function trackWriteTime(filePath: string,): void {
  _writeTimestamps.set(
    resolve(filePath,),
    Date.now(),
  );
}

/**
 * Directly sets a write timestamp for a path.
 * Primarily for testing -- production code should use {@link trackWriteTime}
 * which captures the current time automatically.
 *
 * @param filePath - path to set timestamp for (resolved to absolute)
 *
 * @param timestamp - ms since epoch
 */
export function setWriteTimestamp(
  {
    filePath,
    timestamp,
  }: {
    readonly filePath: string;
    readonly timestamp: number;
  },
): void {
  _writeTimestamps.set(
    resolve(filePath,),
    timestamp,
  );
}

/**
 * Escape hatch for manually registering additional paths that watch mode
 * should monitor. Useful for dependencies that `cat()` cannot track
 * automatically -- for example, files consumed by `exec()` or external
 * tools whose inputs are opaque to the enforcer.
 *
 * @param paths - Array of file paths (resolved to absolute) to add to the read set
 */
export function addWatchedPaths(paths: readonly string[],): void {
  paths.forEach(function addPath(filePath,): void {
    _reads.add(resolve(filePath,),);
  },);
}

//endregion Mutation functions
