import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { dirname, } from 'node:path';
import {
  l,
  tagged,
} from '../log.ts';
import {
  trackDest,
  trackWriteTime,
} from '../tracker.ts';
import {
  readCached,
  updateCache,
} from './cache.ts';
import type { GlobResults, } from './cat.ts';
import { mirrorGlobPath, } from './glob.ts';

/**
 * Ensures the parent directory of a file path exists before writing.
 *
 * @param filePath - Path to the file about to be written
 */
async function ensureDir(filePath: string,): Promise<void> {
  await mkdir(
    dirname(filePath,),
    { recursive: true, },
  );
}

/**
 * Reads the current content of a file via the read cache, returning
 * undefined if the file does not exist. Used for content-based write skipping.
 *
 * @param filePath - Path to check
 *
 * @returns File content as string, or undefined if missing
 */
export async function readExisting(filePath: string,): Promise<string | undefined> {
  try {
    return await readCached(filePath,);
  }
  catch {
    return undefined;
  }
}

/**
 * Core write logic shared by {@link overwrite} and {@link overwriteEach}.
 * Compares content against existing file, skipping when identical.
 * Handles directory creation, cache update, and write-time tracking.
 *
 * @param dest - Destination file path
 *
 * @param content - Content string to write
 *
 * @param sourcePath - Optional source path for log messages (used by overwriteEach)
 */
async function writeIfChanged(
  {
    dest,
    content,
    sourcePath,
  }: {
    readonly dest: string;
    readonly content: string;
    readonly sourcePath?: string;
  },
): Promise<void> {
  /** Function-scoped logger tagged with the call site for traceable write logs. */
  const rl = tagged({
    tag: writeIfChanged.name,
    l,
  },);
  trackDest(dest,);
  /** Current file content, or undefined if file doesn't exist yet */
  const existing = await readExisting(dest,);
  if (existing === content) {
    rl.info(
      `skip (unchanged): ${sourcePath !== undefined ? `${sourcePath} -> ` : ''}${dest}`,
    );
    return;
  }
  await ensureDir(dest,);
  await writeFile(
    dest,
    content,
  );
  updateCache(
    dest,
    content,
  );
  trackWriteTime(dest,);
  rl.info(`${sourcePath !== undefined ? `${sourcePath} -> ` : '-> '}${dest}`,);
}

/**
 * Writes content to dest, skipping the write when existing content is identical.
 * Always registers the path as a managed destination for watch-mode protection.
 *
 * @param dest - Destination file path
 *
 * @param content - Content string to write
 *
 * @example
 * ```ts
 * await overwrite('./dist/config.json', JSON.stringify(config, null, 2));
 * ```
 */
export async function overwrite(
  dest: string,
  content: string,
): Promise<void> {
  await writeIfChanged({
    dest,
    content,
  },);
}

/**
 * Writes content to dest only if the file does not already exist.
 * Uses {@link readExisting} to check for the file rather than a separate
 * `exists()` call, avoiding a TOCTOU race window.
 *
 * @param dest - Destination file path
 *
 * @param content - Content string to write
 *
 * @example
 * ```ts
 * await overwriteIfNotExists('./config/defaults.json', '{}');
 * ```
 */
export async function overwriteIfNotExists(
  dest: string,
  content: string,
): Promise<void> {
  /** Existing content, or undefined if file doesn't exist */
  const existing = await readExisting(dest,);
  if (existing !== undefined) {
    trackDest(dest,);
    l.info(`skip (exists): ${dest}`,);
    return;
  }
  await writeIfChanged({
    dest,
    content,
  },);
}

/**
 * Writes each glob-matched file to its mirrored destination,
 * skipping files whose content is already identical.
 * Source glob is read from the {@link GlobResults} array produced by `cat()`.
 *
 * @param destGlob - Destination glob pattern with positional wildcards
 *
 * @param files - Glob results carrying the source pattern and file contents
 *
 * @example
 * ```ts
 * await overwriteEach('./dest/*​/*.md', await cat('./src/*​/*.md'));
 * ```
 */
export async function overwriteEach(
  destGlob: string,
  files: GlobResults,
): Promise<void> {
  l.info(`overwriteEach: ${String(files.length,)} files`,);
  await Promise.all(
    files.map(async function writeOneGlobMatch(file,): Promise<void> {
      /** Concrete destination path from the mirror-glob mapping */
      const dest = mirrorGlobPath(
        files.sourceGlob,
        destGlob,
        file.path,
      );
      await writeIfChanged({
        dest,
        content: file.content,
        sourcePath: file.path,
      },);
    },),
  );
}
