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

//region Directory walking -- find config files by walking up the filesystem

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
 * const root = findAncestorWithFile("/home/user/project/packages/foo/src", "oxlint.config.ts");
 * // => "/home/user/project"
 * ```
 */
export function findAncestorWithFile(
  startDir: string,
  filename: string,
): string | null {
  let current = startDir;
  // oxlint-disable-next-line no-constant-condition -- walk up until filesystem root
  while (true) {
    if (existsSync(resolve(
      current,
      filename,
    ),)) {
      return current;
    }
    const parent = dirname(current,);
    if (parent === current)
      return null;
    current = parent;
  }
}

//endregion Directory walking

//region Parsing -- convert oxlint JSON diagnostics to our Diagnostic type

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
 * const result = parseOxlintOutput(jsonOutput, "/home/user/project");
 * // => Map { "/home/user/project/src/index.ts" => [{ severity: "ERROR", ... }] }
 * ```
 */
export function parseOxlintOutput(
  output: OxlintJsonOutput,
  cwd: string,
): Map<string, Diagnostic[]> {
  const result = new Map<string, Diagnostic[]>();

  for (const entry of output.diagnostics) {
    const span = entry.labels[0]?.span;
    if (span === undefined)
      continue;

    const absolutePath = resolve(
      cwd,
      entry.filename,
    );
    const message = entry.help !== undefined && entry.help.length > 0
      ? `${entry.message} (help: ${entry.help})`
      : entry.message;
    const diagnostic: Diagnostic = {
      severity: OXLINT_SEVERITY_MAP[entry.severity] ?? `UNKNOWN(${entry.severity})`,
      lnum: span.line,
      col: span.column,
      end_lnum: span.line,
      end_col: span.column,
      message,
      source: 'oxlint',
      code: entry.code,
    };

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
