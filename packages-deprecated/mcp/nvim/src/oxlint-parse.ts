/**
 * Oxlint output parsing and filesystem config discovery.
 *
 * Converts parsed oxlint JSON output into grouped diagnostics
 * and locates config files by walking up the directory tree.
 *
 * @module
 */

import { existsSync, } from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';

import type { Diagnostic, } from './nvim-client.ts';
import {
  OXLINT_SEVERITY_MAP,
  type OxlintJsonOutput,
} from './oxlint-types.ts';

//region Directory walking: find config files by walking up the filesystem

/**
 * Walks up from a starting directory to find a file by name.
 *
 * @param startDir - Directory to begin searching from.
 *
 * @param filename - File to locate in ancestor directories.
 *
 * @returns Absolute path to the directory containing the file, or null if not found.
 *
 * @example
 * ```ts
 * const root = findAncestorWithFile({ startDir: "/home/user/project/packages/foo/src", filename: "oxlint.config.ts" });
 * // => "/home/user/project"
 * ```
 */
export function findAncestorWithFile(
  {
    startDir,
    filename,
  }: {
    startDir: string;
    filename: string;
  },
): string | null {
  /**
   * Walking cursor; advances toward the filesystem root each iteration until the file is found or the root is reached.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- filesystem walking cursor advances toward root each iteration
  let current = startDir;
  while (true) {
    if (existsSync(resolve(
      current,
      filename,
    ),)) {
      return current;
    }
    /**
     * Directory one level above `current`; equal to `current` only at the filesystem root, which terminates the walk.
     */
    const parent = dirname(current,);
    if (parent === current)
      return null;
    current = parent;
  }
}

//endregion Directory walking

//region Parsing: convert oxlint JSON diagnostics to our Diagnostic type

/**
 * Converts a parsed oxlint JSON output into grouped diagnostics keyed by absolute file path.
 * Pure function extracted for testability.
 *
 * @param output - Parsed oxlint JSON output.
 *
 * @param cwd - Working directory used to resolve relative filenames.
 *
 * @returns Map from absolute file path to diagnostics found in that file.
 *
 * @example
 * ```ts
 * const result = parseOxlintOutput({ output: jsonOutput, cwd: "/home/user/project" });
 * // => Map { "/home/user/project/src/index.ts" => [{ severity: "ERROR", ... }] }
 * ```
 */
export function parseOxlintOutput(
  {
    output,
    cwd,
  }: {
    output: OxlintJsonOutput;
    cwd: string;
  },
): Map<string, Diagnostic[]> {
  /**
   * Output accumulator keyed by absolute path; populated below as diagnostics are converted entry by entry.
   */
  const result = new Map<string, Diagnostic[]>();

  for (const entry of output.diagnostics) {
    /**
     * First label span; supplies the line/column for this diagnostic, or `undefined` when oxlint omitted it.
     */
    const span = entry.labels[0]
      ?.span;
    if (span === undefined)
      continue;

    /**
     * Absolute path of the file the diagnostic belongs to; resolved against `cwd` so callers can key off it directly.
     */
    const absolutePath = resolve(
      cwd,
      entry.filename,
    );
    /**
     * Final diagnostic text; appends the optional `help:` block when oxlint provided one.
     */
    const message = ((entry.help
      !== undefined) && (entry.help
        .length
        > 0))
      ? `${entry.message} (help: ${entry.help})`
      : entry.message;
    /**
     * Diagnostic record in the shape consumed by the rest of the pipeline.
     */
    const diagnostic: Diagnostic = {
      severity: OXLINT_SEVERITY_MAP[entry.severity]
        ?? `UNKNOWN(${entry.severity})`,
      lnum: span.line,
      col: span.column,
      end_lnum: span.line,
      end_col: span.column,
      message,
      source: 'oxlint',
      code: entry.code,
    };

    /**
     * Diagnostics already accumulated for this path; extended in place when present to avoid an extra Map write.
     */
    const existing = result.get(absolutePath,);
    if (existing !== undefined)
      existing.push(diagnostic,);
    else {
      result.set(
        absolutePath,
        [diagnostic,],
      );
    }
  }

  return result;
}

//endregion Parsing
