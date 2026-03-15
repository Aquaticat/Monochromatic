/**
 * Item resolution pipeline for task-depends staleness detection.
 *
 * Resolves source/output items (file globs and `sh:` shell commands)
 * to arrays of timestamps. File globs resolve to file modification times;
 * shell commands must output a parseable timestamp on stdout.
 *
 * @module
 */

import { stat, } from 'node:fs/promises';
import { resolve, } from 'node:path';

import { outdent, } from '@cspotcode/outdent';
import spawn from 'nano-spawn';
import readdirGlob from 'tiny-readdir-glob';

import { extractCommand, isShellCommand, parseTimestamp, } from './depends-parse.ts';

//region Glob resolution

/** Index of the first glob metacharacter in a pattern string */
const GLOB_META = /[*?{[]/;

/**
 * Splits a glob pattern into a base directory and a relative glob suffix.
 *
 * Everything before the first wildcard segment becomes the `cwd`;
 * the remainder becomes the pattern passed to the matcher.
 *
 * @param pattern - Glob pattern, absolute or relative
 *
 * @returns Tuple of `[resolvedCwd, relativeGlob]`
 *
 * @example
 * ```ts
 * splitGlob('/tmp/foo/*.ts') // ['/tmp/foo', '*.ts']
 * splitGlob('src/**') // ['/abs/path/src', '**']
 * ```
 */
function splitGlob(pattern: string,): readonly [cwd: string, relativeGlob: string] {
  const metaIndex = pattern.search(GLOB_META,);

  if (metaIndex === -1) {
    return [resolve(pattern,), '',];
  }

  const staticPrefix = pattern.slice(0, metaIndex,);
  const lastSep = staticPrefix.lastIndexOf('/',);

  if (lastSep === -1) {
    return [resolve('.',), pattern,];
  }

  return [resolve(staticPrefix.slice(0, lastSep,),), pattern.slice(lastSep + 1,),];
}

/**
 * Resolves a glob pattern into file paths using `tiny-readdir-glob`.
 *
 * @param pattern - Glob pattern to expand
 *
 * @returns Array of matched absolute file paths
 *
 * @example
 * ```ts
 * const files = await resolveGlobFiles('src/*.ts');
 * ```
 */
async function resolveGlobFiles(pattern: string,): Promise<string[]> {
  const [cwd, relativeGlob,] = splitGlob(pattern,);

  if (relativeGlob === '') {
    return [cwd,];
  }

  const { files, } = await readdirGlob(relativeGlob, { cwd, },);
  return files;
}

//endregion Glob resolution

//region Item resolution -- resolve individual items to timestamps

/**
 * Resolves a file glob to an array of file mtimes.
 *
 * When the glob matches no files, returns an empty array.
 * Empty arrays contribute no timestamps to the strategy aggregation,
 * which returns `-Infinity` ("no information") for empty input.
 *
 * @param pattern - File glob pattern
 *
 * @param position - Whether this is a source or output item (for logging)
 *
 * @param verbose - Whether to log diagnostic messages
 *
 * @returns Array of file mtimes in milliseconds, or empty when no files match
 *
 * @example
 * ```ts
 * const mtimes = await resolveGlob('src/*.ts', 'source', false);
 * ```
 */
async function resolveGlob(
  pattern: string, position: 'source' | 'output', verbose: boolean,
): Promise<number[]> {
  const files = await resolveGlobFiles(pattern,);

  if (files.length === 0) {
    if (verbose) {
      console.error(`[task-depends] ${position} glob "${pattern}" matched no files`,);
    }
    return [];
  }

  const mtimes: number[] = [];
  for (const file of files) {
    const fileStat = await stat(file,);
    mtimes.push(fileStat.mtimeMs,);
  }

  if (verbose) {
    console.error(`[task-depends] ${position} glob "${pattern}" matched ${files.length} files`,);
  }

  return mtimes;
}

/**
 * Resolves a shell command to a single timestamp.
 *
 * Commands must output a parseable timestamp on stdout:
 * unix epoch (seconds or ms), ISO 8601, `Infinity`, or `-Infinity`.
 *
 * Non-zero exit codes throw an error rather than being silently
 * interpreted, preventing subtle bugs when commands fail unexpectedly.
 *
 * @param command - Shell command to execute (without `sh:` prefix)
 *
 * @param position - Whether this is a source or output item (for error messages)
 *
 * @param verbose - Whether to log diagnostic messages
 *
 * @returns Resolved timestamp in milliseconds (possibly `Infinity` or `-Infinity`)
 *
 * @throws When command exits with non-zero code or stdout is not a parseable timestamp
 *
 * @example
 * ```ts
 * // Timestamp from stdout
 * await resolveShellCommand('git log -1 --format=%ct', 'source', false)
 * // Gate pattern: explicit Infinity/-Infinity
 * await resolveShellCommand('podman image exists img && echo Infinity || echo -Infinity', 'output', false)
 * ```
 */
async function resolveShellCommand(
  command: string, position: 'source' | 'output', verbose: boolean,
): Promise<number> {
  /** Raw stdout from the command */
  let stdout = '';

  try {
    const result = await spawn(command, { shell: true, },);
    stdout = result.stdout.trim();
  }
  catch (error) {
    throw new Error(
      outdent`
        ${position} sh: "${command}" failed with non-zero exit code
        Commands must succeed and output a timestamp (unix epoch, ISO 8601, Infinity, or -Infinity)
        Example: sh:${command} && echo Infinity || echo -Infinity
      `,
      { cause: error, },
    );
  }

  const parsed = parseTimestamp(stdout,);
  if (parsed === undefined) {
    throw new Error(
      outdent`
        ${position} sh: "${command}" returned unparseable output: "${stdout}"
        Commands must output a timestamp (unix epoch, ISO 8601, Infinity, or -Infinity)
      `,
    );
  }

  if (verbose) {
    const display = Number.isFinite(parsed,)
      ? new Date(parsed,).toISOString()
      : String(parsed,);
    console.error(
      `[task-depends] ${position} sh: "${command}" → ${display}`,
    );
  }

  return parsed;
}

/**
 * Resolves an array of source or output items to timestamps.
 *
 * Each item is either a file glob (resolved to file mtimes) or a `sh:` prefixed
 * shell command (resolved to a single timestamp from stdout).
 *
 * @param items - Array of glob patterns and/or `sh:` commands
 *
 * @param position - Whether these are source or output items
 *
 * @param verbose - Whether to log diagnostic messages
 *
 * @returns Flat array of all resolved timestamps
 *
 * @example
 * ```ts
 * const ts = await resolveItems(['src/*.ts', 'sh:git log -1 --format=%ct'], 'source', false);
 * ```
 */
export async function resolveItems(
  items: readonly string[], position: 'source' | 'output', verbose: boolean,
): Promise<number[]> {
  const timestamps: number[] = [];

  for (const item of items) {
    if (isShellCommand(item,)) {
      const ts = await resolveShellCommand(extractCommand(item,), position, verbose,);
      timestamps.push(ts,);
    }
    else {
      const ts = await resolveGlob(item, position, verbose,);
      timestamps.push(...ts,);
    }
  }

  return timestamps;
}

//endregion Item resolution
