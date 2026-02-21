import { stat, } from 'node:fs/promises';
import {
  dirname,
  join,
  resolve,
} from 'node:path';
import {
  reads,
  writeTimestamps,
  writes,
} from './tracker.ts';

/** Possible outcomes when classifying a filesystem event */
export type EventKind = 'source' | 'protected' | 'ignore';

/**
 * Derives the unique set of parent directories that need `fs.watch` watchers,
 * covering every tracked read path, every tracked write path (for protection),
 * and the config file itself.
 * @param configPath - Absolute path to the config file
 * @returns Set of absolute directory paths to watch
 */
export function watchDirs(configPath: string): Set<string> {
  /** All paths that need monitoring: reads, writes, and the config */
  const allPaths = [...reads, ...writes, resolve(configPath)];
  return new Set(allPaths.map((filePath) => dirname(filePath)));
}

/**
 * Classifies a filesystem event into one of three categories:
 * - `source`: a tracked read or the config file changed -- normal re-run
 * - `protected`: a managed destination was modified externally -- re-run + notify
 * - `ignore`: unrelated file or our own write echo -- skip
 *
 * For write paths, uses `stat()` to compare the file's mtime against our
 * recorded write timestamp. If mtime > our timestamp, the edit is external.
 * @param filename - Filename from the fs.watch event (relative to watched dir)
 * @param watchedDir - Absolute path of the directory being watched
 * @param configPath - Absolute path of the config file
 * @returns Classification of the event
 */
export async function classifyEvent(
  filename: string,
  watchedDir: string,
  configPath: string,
): Promise<EventKind> {
  /** Absolute path of the changed file */
  const absolutePath = resolve(join(watchedDir, filename));

  if (writes.has(absolutePath)) {
    /** Timestamp of our last actual write, if any */
    const ourWriteTime = writeTimestamps.get(absolutePath);
    if (ourWriteTime === undefined) {
      // We registered the dest but never actually wrote (content was unchanged).
      // An fs.watch event for this path must be external.
      return 'protected';
    }
    try {
      /** File metadata for mtime comparison */
      const fileStat = await stat(absolutePath);
      // External edit: file was modified after our last write
      if (fileStat.mtimeMs > ourWriteTime) {
        return 'protected';
      }
    } catch {
      // File may have been deleted externally
      return 'protected';
    }
    // mtime <= our write time: this is our own write echoing through fs.watch
    return 'ignore';
  }

  /** Resolved config path for comparison */
  const resolvedConfig = resolve(configPath);

  if (reads.has(absolutePath) || absolutePath === resolvedConfig) {
    return 'source';
  }

  return 'ignore';
}

/**
 * Backwards-compatible wrapper that returns true for any actionable event.
 * @param filename - Filename from the fs.watch event (relative to watched dir)
 * @param watchedDir - Absolute path of the directory being watched
 * @param configPath - Absolute path of the config file
 * @returns Whether this event should trigger a re-run
 */
export async function shouldTrigger(
  filename: string,
  watchedDir: string,
  configPath: string,
): Promise<boolean> {
  return (await classifyEvent(filename, watchedDir, configPath)) !== 'ignore';
}
