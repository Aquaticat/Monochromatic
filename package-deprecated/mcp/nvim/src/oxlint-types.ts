/**
 * Type definitions for oxlint JSON output.
 *
 * Describes the shape of `oxlint --format json` stdout
 * so the parser can safely destructure the response.
 *
 * @module
 */

//region Types: oxlint JSON output shape

/**
 * Span location within a single diagnostic label.
 *
 * @example
 * ```ts
 * const span: OxlintSpan = { offset: 100, length: 20, line: 5, column: 3 };
 * ```
 */
export type OxlintSpan = {
  readonly offset: number;
  readonly length: number;
  readonly line: number;
  readonly column: number;
};

/**
 * Single label attached to an oxlint diagnostic.
 *
 * @example
 * ```ts
 * const label: OxlintLabel = { span: { offset: 0, length: 10, line: 1, column: 1 } };
 * ```
 */
export type OxlintLabel = {
  readonly span: OxlintSpan;
};

/**
 * Single diagnostic entry from oxlint `--format json` output.
 *
 * @example
 * ```ts
 * const entry: OxlintDiagnostic = {
 *
 *   message: "Missing TSDoc comment.",
 *
 *   code: "tsdoc(require-tsdoc)",
 *
 *   severity: "error",
 *
 *   causes: [],
 *
 *   filename: "src/index.ts",
 *
 *   labels: [{ span: { offset: 0, length: 10, line: 1, column: 1 } }],
 *
 *   related: [],
 * };
 * ```
 */
export type OxlintDiagnostic = {
  readonly message: string;
  readonly code: string;
  readonly severity: string;
  readonly causes: readonly string[];
  readonly filename: string;
  readonly labels: readonly OxlintLabel[];
  readonly related: readonly unknown[];
  readonly url?: string;
  readonly help?: string;
};

/**
 * Top-level shape of oxlint `--format json` stdout.
 *
 * @example
 * ```ts
 * const output: OxlintJsonOutput = {
 *
 *   diagnostics: [],
 *
 *   number_of_files: 1,
 *
 *   number_of_rules: 300,
 *
 *   threads_count: 8,
 *
 *   start_time: 0.05,
 * };
 * ```
 */
export type OxlintJsonOutput = {
  readonly diagnostics: readonly OxlintDiagnostic[];
  readonly number_of_files: number;
  readonly number_of_rules: number;
  readonly threads_count: number;
  readonly start_time: number;
};

//endregion Types

//region Severity mapping: oxlint lowercase to our uppercase format

/**
 * Maps oxlint severity strings to the uppercase format used by editor diagnostics.
 */
export const OXLINT_SEVERITY_MAP: Record<string, string> = {
  error: 'ERROR',
  warning: 'WARN',
};

//endregion Severity mapping
