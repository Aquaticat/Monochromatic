import { Glob, } from 'bun';
import { readCached, } from './cache.ts';
import { expandGlob, } from './glob.ts';
import { trackRead, } from '../tracker.ts';

/** Result of expanding a glob: each matched file with its path and content */
export type GlobResult = {
  readonly path: string;
  readonly content: string;
};

/** Glob characters that trigger pattern expansion inside cat-array paths */
const GLOB_CHARS = /[*?]/;

/**
 * Reads files by glob pattern, keeping them separate for `overwriteEach()`.
 * @param glob - Glob pattern to match source files
 * @returns Array of matched files with their paths and contents
 */
export async function cat(glob: string): Promise<readonly GlobResult[]>;

/**
 * Reads and concatenates listed files into a single string.
 * Paths containing `*` or `?` are auto-expanded as globs before concatenation.
 * @param files - Array of file paths (or glob patterns) to concatenate
 * @returns Concatenated file contents joined by newlines
 */
export async function cat(files: readonly string[]): Promise<string>;

export async function cat(input: string | readonly string[]): Promise<string | readonly GlobResult[]> {
  if (typeof input === 'string') {
    /** Paths matched by the glob pattern */
    const paths = await expandGlob(input);
    return await Promise.all(
      paths.map(async function readGlobMatch(path: string): Promise<GlobResult> {
        trackRead(path);
        return { path, content: await readCached(path), };
      }),
    );
  }

  /** Expand any glob patterns in the array, then flatten */
  const expandedGroups = await Promise.all(
    input.map(async function expandOnePath(path: string): Promise<readonly string[]> {
      if (GLOB_CHARS.test(path)) {
        return await expandGlob(path);
      }
      return [path];
    }),
  );

  /** File contents read in parallel */
  const contents = await Promise.all(
    expandedGroups.flat().map(async function readOneFile(filePath: string): Promise<string> {
      trackRead(filePath);
      return await readCached(filePath);
    }),
  );
  return contents.join('\n');
}
