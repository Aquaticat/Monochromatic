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
import {
  destinationsForFiles,
  writeGlobDestinations,
} from './write-each-destinations.ts';
import {
  isContentBuilder,
  isGlobResultsBuilder,
  type OverwriteContent,
  type OverwriteEachFiles,
  type WriteIfChanged,
  writeLazyEach,
  writeLazyIfChanged,
} from './write-lazy.ts';
import {
  rememberEagerEach,
  rememberEagerWrite,
} from './write-staleness.ts';

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
 * Sentinel for "file does not exist" returned by {@link readExisting}.
 * A unique `Symbol` keeps the absent case out of a banned `string | undefined`
 * union and stays distinguishable from real file content, including the empty
 * string (a present but empty file is content, not absence).
 */
export const MISSING: unique symbol = Symbol('missing-file',);

/**
 * Reads the current content of a file via the read cache, returning
 * {@link MISSING} if the file does not exist. Used for content-based write skipping.
 *
 * @param filePath - Path to check
 *
 * @returns File content as string, or {@link MISSING} if absent
 *
 * @example
 * ```ts
 * const existing = await readExisting('./dist/config.json');
 * if (existing === MISSING) {
 *   // file did not exist; safe to create
 * }
 * ```
 */
export async function readExisting(filePath: string,): Promise<string | typeof MISSING> {
  try {
    return await readCached(filePath,);
  }
  catch {
    return MISSING;
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
 *
 * @param manifestPath - Optional staleness manifest path override
 *
 * @param recordStaleness - Whether reconciliation should record eager staleness metadata
 */
async function writeIfChanged(
  {
    dest,
    content,
    sourcePath,
    manifestPath,
    recordStaleness,
  }: {
    readonly dest: string;
    readonly content: string;
    readonly sourcePath?: string;
    readonly manifestPath?: string;
    readonly recordStaleness?: boolean;
  },
): Promise<void> {
  /**
   * Function-scoped logger tagged with the call site for traceable write logs.
   */
  const rl = tagged({
    tag: writeIfChanged.name,
    l,
  },);
  trackDest(dest,);
  /**
   * Current file content, or MISSING if file doesn't exist yet
   */
  const existing = await readExisting(dest,);
  if (existing === content) {
    rl.debug(
      `skip (unchanged): ${sourcePath !== undefined ? `${sourcePath} -> ` : ''}${dest}`,
    );
    if (recordStaleness !== false) {
      rememberEagerWrite(manifestPath === undefined
        ? {
          dest,
          content,
        }
        : {
          dest,
          content,
          manifestPath,
        },);
    }
    return;
  }
  await ensureDir(dest,);
  await writeFile(
    dest,
    content,
  );
  updateCache({
    filePath: dest,
    content,
  },);
  trackWriteTime(dest,);
  if (recordStaleness !== false) {
    rememberEagerWrite(manifestPath === undefined
      ? {
        dest,
        content,
      }
      : {
        dest,
        content,
        manifestPath,
      },);
  }
  rl.info(`${sourcePath !== undefined ? `${sourcePath} -> ` : '-> '}${dest}`,);
}

/**
 * Public write function passed into lazy helpers without exposing `writeIfChanged`.
 */
const writeIfChangedForLazy: WriteIfChanged = writeIfChanged;

/**
 * Writes content to dest, skipping the write when existing content is identical.
 * Always registers the path as a managed destination for watch-mode protection.
 * Lazy content builders are skipped entirely when the staleness manifest proves
 * that previous sources and destination metadata are unchanged.
 *
 * @param dest - Destination file path
 *
 * @param content - Content string to write, or lazy builder that returns it
 *
 * @param manifestPath - Optional staleness manifest path override
 *
 * @example
 * ```ts
 * await overwrite({
 *   dest: './dist/config.json',
 *   content: async function buildConfig(): Promise<string> {
 *     return JSON.stringify(config, null, 2);
 *   },
 * });
 * ```
 */
export async function overwrite(
  {
    dest,
    content,
    manifestPath,
  }: {
    readonly dest: string;
    readonly content: OverwriteContent;
    readonly manifestPath?: string;
  },
): Promise<void> {
  if (isContentBuilder(content,)) {
    await writeLazyIfChanged(manifestPath === undefined
      ? {
        dest,
        content,
        writeIfChanged: writeIfChangedForLazy,
      }
      : {
        manifestPath,
        dest,
        content,
        writeIfChanged: writeIfChangedForLazy,
      },);
    return;
  }

  await writeIfChanged(manifestPath === undefined
    ? {
      dest,
      content,
    }
    : {
      dest,
      content,
      manifestPath,
    },);
}

/**
 * Writes content to dest only if the file does not already exist.
 * Uses {@link readExisting} to check for the file rather than a separate
 * `exists()` call, avoiding a TOCTOU race gap.
 *
 * @param dest - Destination file path
 *
 * @param content - Content string to write
 *
 * @example
 * ```ts
 * await overwriteIfNotExists({
 *   dest: './config/defaults.json',
 *   content: '{}',
 * });
 * ```
 */
export async function overwriteIfNotExists(
  {
    dest,
    content,
  }: {
    readonly dest: string;
    readonly content: string;
  },
): Promise<void> {
  /**
   * Existing content, or MISSING if file doesn't exist
   */
  const existing = await readExisting(dest,);
  if (existing !== MISSING) {
    trackDest(dest,);
    l.debug(`skip (exists): ${dest}`,);
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
 * await overwriteEach({
 *   destGlob: './dest/*​/*.md',
 *   files: await cat('./src/*​/*.md'),
 * });
 * ```
 */
export async function overwriteEach(
  {
    destGlob,
    files,
    manifestPath,
  }: {
    readonly destGlob: string;
    readonly files: OverwriteEachFiles;
    readonly manifestPath?: string;
  },
): Promise<void> {
  if (isGlobResultsBuilder(files,)) {
    await writeLazyEach(manifestPath === undefined
      ? {
        destGlob,
        files,
        writeIfChanged: writeIfChangedForLazy,
      }
      : {
        manifestPath,
        destGlob,
        files,
        writeIfChanged: writeIfChangedForLazy,
      },);
    return;
  }

  l.info(`overwriteEach: ${String(files.length,)} files`,);
  /**
   * Concrete destinations for the eager glob mirror rule.
   */
  const destinations = destinationsForFiles({
    destGlob,
    files,
  },);
  await writeGlobDestinations({
    destinations,
    writeIfChanged: writeIfChangedForLazy,
  },);
  rememberEagerEach(manifestPath === undefined
    ? {
      destGlob,
      destinations,
    }
    : {
      destGlob,
      destinations,
      manifestPath,
    },);
}
