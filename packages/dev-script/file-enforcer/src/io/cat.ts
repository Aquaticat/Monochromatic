import { readCached, } from './cache.ts';
import { expandGlob, } from './glob.ts';
import { trackRead, } from '../tracker.ts';

/** Result of expanding a glob: each matched file with its path and content */
export type GlobResult = {
  readonly path: string;
  readonly content: string;
};

/** Array of glob results carrying the source pattern used to produce them */
export type GlobResults = readonly GlobResult[] & {
  readonly sourceGlob: string;
};

/**
 * Creates a {@link GlobResults} array from a source glob and its matched files.
 * Useful for constructing results outside of `cat()` (e.g. in tests).
 *
 * @param sourceGlob - Glob pattern that produced the results
 *
 * @param results - Matched files with paths and contents
 *
 * @returns Branded array with the source glob attached
 *
 * @example
 * ```ts
 * const files = globResults(join(srcDir, '*.ts'), [
 *   { path: join(srcDir, 'a.ts'), content: 'alpha' },
 * ]);
 * ```
 */
export function globResults(sourceGlob: string, results: readonly GlobResult[]): GlobResults {
  return Object.assign([...results], { sourceGlob, }) as unknown as GlobResults;
}

/** Glob characters that trigger pattern expansion inside cat-array paths */
const GLOB_CHARS = /[*?]/;

/**
 * Reads files by glob pattern, keeping them separate for `overwriteEach()`.
 * @param glob - Glob pattern to match source files
 * @returns Array of matched files with their paths, contents, and source glob
 */
export async function cat(glob: string): Promise<GlobResults>;

/**
 * Reads and concatenates listed files into a single string.
 * Paths containing `*` or `?` are auto-expanded as globs before concatenation.
 * @param files - Array of file paths (or glob patterns) to concatenate
 * @returns Concatenated file contents joined by newlines
 */
export async function cat(files: readonly string[]): Promise<string>;

/** {@inheritDoc cat} */
export async function cat(input: string | readonly string[]): Promise<string | GlobResults> {
  if (typeof input === 'string') {
    /** Paths matched by the glob pattern */
    const paths = await expandGlob(input);
    /** Matched files with their contents */
    const results = await Promise.all(
      paths.map(async function readGlobMatch(path: string): Promise<GlobResult> {
        trackRead(path);
        return { path, content: await readCached(path), };
      }),
    );
    return globResults(input, results);
  }

  /** Expand any glob patterns in the array, then flatten */
  const expandedGroups = await Promise.all(
    input.map(function expandOnePath(path: string): Promise<readonly string[]> | readonly string[] {
      if (GLOB_CHARS.test(path)) {
        return expandGlob(path);
      }
      return [path];
    }),
  );

  /** File contents read in parallel */
  const contents = await Promise.all(
    expandedGroups.flat().map(function readOneFile(filePath: string): Promise<string> {
      trackRead(filePath);
      return readCached(filePath);
    }),
  );
  return contents.join('\n');
}
