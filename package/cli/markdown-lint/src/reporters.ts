import type { Diagnostic, } from './types.ts';

/**
 * One file's diagnostics, with the path already prepared for display (the CLI
 * relativizes it).
 */
export type FileReport = {
  /**
   * Display path for the file.
   */
  readonly path: string;
  /**
   * Diagnostics reported for the file.
   */
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Supported reporter names: a human-readable default and a machine-readable
 * JSON form for CI.
 */
export type ReporterName = 'pretty' | 'json';

/**
 * Render diagnostics in the readable default format, one line per diagnostic as
 * `path:line:column  ruleId  message`, grep-friendly and stable.
 *
 * @param files - per-file diagnostics with display paths
 *
 * @returns text report, empty string when there are no diagnostics
 *
 * @example
 * ```ts
 * pretty([{ path: 'a.md', diagnostics: [d] }]); // 'a.md:3:1  MD025  ...'
 * ```
 */
function pretty(files: readonly FileReport[],): string {
  return files
    .flatMap(function fileLines(file: FileReport,): readonly string[] {
      return file.diagnostics
        .map(function diagnosticLine(diagnostic: Diagnostic,): string {
        return `${file.path}:${diagnostic.line}:${diagnostic.column}  ${diagnostic.ruleId}  ${diagnostic.message}`;
      },);
    },)
    .join('\n',);
}

/**
 * Render diagnostics as a JSON array, one object per diagnostic, for CI
 * consumption. `fixable` reports whether a fix was attached.
 *
 * @param files - per-file diagnostics with display paths
 *
 * @returns pretty-printed JSON array
 *
 * @example
 * ```ts
 * json([{ path: 'a.md', diagnostics: [d] }]); // '[ { "path": "a.md", ... } ]'
 * ```
 */
function json(files: readonly FileReport[],): string {
  return JSON.stringify(
    files.flatMap(function fileObjects(file: FileReport,): readonly Record<string, unknown>[] {
      return file.diagnostics
        .map(function diagnosticObject(diagnostic: Diagnostic,): Record<string, unknown> {
        return {
          path: file.path,
          line: diagnostic.line,
          column: diagnostic.column,
          ruleId: diagnostic.ruleId,
          message: diagnostic.message,
          fixable: diagnostic.fix !== undefined,
        };
      },);
    },),
    undefined,
    2,
  );
}

/**
 * Reporters keyed by name: {@link pretty} for `pretty`, {@link json} for `json`.
 */
const REPORTERS: Readonly<Record<ReporterName, (files: readonly FileReport[],) => string>> = {
  pretty,
  json,
};

/**
 * Parameters for {@link report}.
 */
export type ReportParams = {
  /**
   * Reporter to render with.
   */
  readonly reporter: ReporterName;
  /**
   * Per-file diagnostics with display paths.
   */
  readonly files: readonly FileReport[];
};

/**
 * Render per-file diagnostics with the named reporter.
 *
 * @param reporter - reporter to render with
 *
 * @param files - per-file diagnostics with display paths
 *
 * @returns rendered report
 *
 * @example
 * ```ts
 * report({ reporter: 'pretty', files });
 * ```
 */
export function report({
  reporter,
  files,
}: ReportParams,): string {
  return REPORTERS[reporter](files,);
}
