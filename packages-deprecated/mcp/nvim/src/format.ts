/**
 * Diagnostic shape expected by the formatter.
 * Matches the fields returned by nvim-client's getDiagnostics.
 *
 * @example
 * ```ts
 * const diag: FormattableDiagnostic = {
 *   severity: 'ERROR',
 *   lnum: 10,
 *   col: 5,
 *   source: 'typescript',
 *   code: 2345,
 *   message: 'Type mismatch',
 * };
 * ```
 */
export type FormattableDiagnostic = {
  readonly severity: string;
  readonly lnum: number;
  readonly col: number;
  readonly source: string | null;
  readonly code: string | number | null;
  readonly message: string;
};

/**
 * Formats a single diagnostic into a human-readable line.
 * Includes source and code when available, with optional indentation.
 *
 * @param diagnostic - Diagnostic to format.
 *
 * @param indent - Whitespace prefix for each line. Defaults to empty string.
 *
 * @returns Formatted single-line string.
 *
 * @example
 * ```ts
 * formatDiagnostic({
 *   diagnostic: { severity: 'ERROR', lnum: 10, col: 5, source: 'ts', code: 2345, message: 'Bad type' },
 * });
 * // => 'ERROR 10:5 [ts 2345] Bad type'
 * ```
 */
export function formatDiagnostic(
  {
    diagnostic,
    indent = '',
  }: {
    diagnostic: FormattableDiagnostic;
    indent?: string;
  },
): string {
  /**
   * Bracketed source-and-code suffix, or empty string when no source info is attached.
   */
  const source = ((diagnostic.source
    !== null) && (diagnostic.source
      !== ''))
    ? ` [${diagnostic.source}${
      diagnostic.code
        !== null ? ` ${String(diagnostic.code,)}` : ''
    }]`
    : '';
  return `${indent}${diagnostic.severity} ${diagnostic.lnum}:${diagnostic.col}${source} ${diagnostic.message}`;
}
