// Splitting further would fragment the oxlint result type, parser, and runner into
// incoherent pieces with shared state. The file is self-contained at just over 100 lines.
/**
 * Oxlint integration: runs oxlint --format json and parses the output into
 * structured severity counts and violated rule IDs.
 *
 * oxlint exits non-zero when it finds violations; stdout still contains valid JSON.
 * The error handler extracts stdout from the rejected error for parsing.
 */
import { execPromise, getStdoutFromError, LINT_TIMEOUT_MS, } from './linter-exec.ts';

//region Types -- oxlint JSON output shape and the parsed result type returned to callers

/** Shape of a single oxlint diagnostic in JSON output */
type OxlintDiagnostic = {
  readonly code?: string;
  readonly severity?: string;
  readonly message?: string;
  readonly labels?: ReadonlyArray<{ readonly span?: { readonly line?: number } }>;
};

/** Parsed oxlint result */
export type OxlintResult = {
  readonly errors: number;
  readonly warnings: number;
  readonly violationCount: number;
  readonly violatedRules: readonly string[];
  readonly linterRan: boolean;
  readonly rawOutput: string;
};

//endregion Types

//region Parsing -- converts raw JSON from oxlint --format json into structured OxlintResult

/**
 * Formats oxlint JSON diagnostics into human-readable lines for model feedback.
 * @param diagnostics - parsed diagnostic objects
 * @returns one-line-per-violation string
 */
function formatOxlintDiagnostics(diagnostics: readonly OxlintDiagnostic[]): string {
  return diagnostics.map((diagnostic) => {
    const line = diagnostic.labels?.[0]?.span?.line ?? '?';
    const severity = diagnostic.severity ?? 'error';
    const code = diagnostic.code ?? 'unknown';
    const message = diagnostic.message ?? '';
    return `line ${String(line)}: ${severity} [${code}] ${message}`;
  }).join('\n');
}

/**
 * Parses oxlint JSON output, counting violations by severity.
 * @param jsonOutput - raw JSON string from oxlint --format json
 * @returns parsed result with severity breakdown and raw diagnostic text
 */
function parseOxlintJson(jsonOutput: string): OxlintResult {
  try {
    const parsed = JSON.parse(jsonOutput.trim()) as {
      diagnostics?: readonly OxlintDiagnostic[];
    };
    const diagnostics = parsed.diagnostics ?? [];
    const errors = diagnostics.filter((d) => d.severity === 'error').length;
    const warnings = diagnostics.filter((d) => d.severity === 'warning').length;
    const violatedRules = [
      ...new Set(diagnostics.map((d) => d.code ?? 'unknown').filter((code) => code !== 'unknown')),
    ];
    return {
      errors,
      warnings,
      violationCount: diagnostics.length,
      violatedRules,
      linterRan: true,
      rawOutput: formatOxlintDiagnostics(diagnostics),
    };
  } catch (parseError) {
    console.error('    [lint:oxlint] failed to parse JSON output:', parseError);
    return { errors: 0, warnings: 0, violationCount: 0, violatedRules: [], linterRan: false, rawOutput: '', };
  }
}

//endregion Parsing

//region Runner -- spawns oxlint, handles non-zero exits (oxlint exits 1 on violations), returns OxlintResult

/**
 * Runs oxlint --format json on a file, returns parsed severity breakdown.
 * oxlint exits non-zero on violations; stdout still contains valid JSON.
 * @param filePath - absolute path to the file to lint
 * @returns parsed oxlint result
 */
export async function runAndParseOxlint(filePath: string): Promise<OxlintResult> {
  try {
    const output = await execPromise('oxlint', ['--format', 'json', filePath], {
      timeout: LINT_TIMEOUT_MS,
    });
    return parseOxlintJson(output);
  } catch (error) {
    // oxlint exits non-zero when there are lint errors; stdout still has valid JSON
    const stdout = getStdoutFromError(error);
    if (stdout.includes('"diagnostics"')) return parseOxlintJson(stdout);
    console.error(`    [lint:oxlint] failed: ${String(error)}`);
    return { errors: 0, warnings: 0, violationCount: 0, violatedRules: [], linterRan: false, rawOutput: '', };
  }
}

//endregion Runner
