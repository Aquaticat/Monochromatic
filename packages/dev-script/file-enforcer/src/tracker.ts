import { resolve, } from 'node:path';

/**
 * Absolute paths of files read during config execution.
 * Populated by `cat()` as a side effect so watch mode knows what to monitor.
 */
export const reads: Set<string> = new Set<string>();

/**
 * Absolute paths of all managed destination files.
 * Populated by `overwrite()` / `overwriteEach()` even when content
 * is unchanged and the actual write is skipped.
 */
export const writes: Set<string> = new Set<string>();

/**
 * Timestamps (ms since epoch) of actual file writes, keyed by absolute path.
 * Only populated when content was different and a real write occurred.
 * Used by `classifyEvent` to distinguish our write echoes from external edits
 * by comparing against the file's mtime.
 */
export const writeTimestamps: Map<string, number> = new Map<string, number>();

/**
 * Clears tracking state between watch-mode re-runs so stale paths
 * from a previous execution don't linger.
 * Preserves `writeTimestamps` because echo detection needs to survive across re-runs.
 */
export function reset(): void {
  reads.clear();
  writes.clear();
}

/** Records a read path, resolving to absolute for reliable watch comparisons. */
export function trackRead(filePath: string): void {
  reads.add(resolve(filePath));
}

/**
 * Registers a path as a managed destination without recording a write timestamp.
 * Called unconditionally in write functions so watch mode knows to protect the
 * file, even when content was unchanged and the actual write was skipped.
 */
export function trackDest(filePath: string): void {
  writes.add(resolve(filePath));
}

/**
 * Records the timestamp of an actual file write for echo suppression.
 * Must be called **after** the write completes so the file's mtime
 * is guaranteed to be <= the recorded timestamp.
 */
export function trackWriteTime(filePath: string): void {
  writeTimestamps.set(resolve(filePath), Date.now());
}

/**
 * Escape hatch for manually registering additional paths that watch mode
 * should monitor. Useful for dependencies that `cat()` cannot track
 * automatically -- for example, files consumed by `exec()` or external
 * tools whose inputs are opaque to the enforcer.
 * @param paths - Array of file paths (resolved to absolute) to add to the read set
 */
export function addWatchedPaths(paths: readonly string[]): void {
  paths.forEach((filePath) => reads.add(resolve(filePath)));
}
