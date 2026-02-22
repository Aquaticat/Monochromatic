import { exists, } from 'node:fs/promises';
import { dirname, } from 'node:path';
import { mkdir, } from 'node:fs/promises';
import { readCached, updateCache, } from './cache.ts';
import type { GlobResult, } from './cat.ts';
import { mirrorGlobPath, } from './glob.ts';
import { trackDest, trackWriteTime, } from '../tracker.ts';

/**
 * Ensures the parent directory of a file path exists before writing.
 * @param filePath - Path to the file about to be written
 */
async function ensureDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true, });
}

/**
 * Reads the current content of a file via the read cache, returning
 * undefined if the file does not exist. Used for content-based write skipping.
 * @param filePath - Path to check
 * @returns File content as string, or undefined if missing
 */
async function readExisting(filePath: string): Promise<string | undefined> {
  try {
    return await readCached(filePath);
  } catch {
    return undefined;
  }
}

/**
 * Writes content to dest, skipping the write when existing content is identical.
 * Always registers the path as a managed destination for watch-mode protection.
 * @param dest - Destination file path
 * @param content - Content string to write
 */
export async function overwrite(dest: string, content: string): Promise<void> {
  trackDest(dest);
  /** Current file content, or undefined if file doesn't exist yet */
  const existing = await readExisting(dest);
  if (existing === content) {
    console.log(`[file-enforcer] skip (unchanged): ${dest}`);
    return;
  }
  await ensureDir(dest);
  await Bun.write(dest, content);
  updateCache(dest, content);
  trackWriteTime(dest);
  console.log(`[file-enforcer] -> ${dest}`);
}

/**
 * Writes content to dest only if the file does not already exist.
 * @param dest - Destination file path
 * @param content - Content string to write
 */
export async function overwriteIfNotExists(dest: string, content: string): Promise<void> {
  if (await exists(dest)) {
    trackDest(dest);
    console.log(`[file-enforcer] skip (exists): ${dest}`);
    return;
  }
  await overwrite(dest, content);
}

/**
 * Writes each glob-matched file to its mirrored destination,
 * skipping files whose content is already identical.
 * @param destGlob - Destination glob pattern with positional wildcards
 * @param sourceGlob - Source glob pattern used to match the files
 * @param files - Glob results to write
 */
export async function overwriteEach(
  destGlob: string,
  sourceGlob: string,
  files: readonly GlobResult[],
): Promise<void> {
  console.log(`[file-enforcer] overwriteEach: ${String(files.length)} files`);
  await Promise.all(
    files.map(async function writeOneGlobMatch(file: GlobResult): Promise<void> {
      /** Concrete destination path from the mirror-glob mapping */
      const dest = mirrorGlobPath(sourceGlob, destGlob, file.path);
      trackDest(dest);
      /** Skip if content is already identical */
      const existing = await readExisting(dest);
      if (existing === file.content) {
        console.log(`[file-enforcer] skip (unchanged): ${file.path} -> ${dest}`);
        return;
      }
      await ensureDir(dest);
      await Bun.write(dest, file.content);
      updateCache(dest, file.content);
      trackWriteTime(dest);
      console.log(`[file-enforcer] ${file.path} -> ${dest}`);
    }),
  );
}
