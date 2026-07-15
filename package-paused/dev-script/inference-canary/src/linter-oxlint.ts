// Splitting further would fragment the oxlint result type, parser, and runner into
// incoherent pieces with shared state. The file is self-contained at just over 100 lines.
/**
 * Oxlint integration: runs oxlint --format json and parses the output into
 * structured severity counts and violated rule IDs.
 *
 * oxlint exits non-zero when it finds violations; stdout still contains valid JSON.
 * The error handler extracts stdout from the rejected error for parsing.
 */
import {
  execPromise,
  getStdoutFromError,
  LINT_TIMEOUT_MS,
} from './linter-exec.ts';
import {
  l,
  tagged,
} from './log.ts';

//region Types: oxlint JSON output shape and the parsed result type returned to callers

/**
 * Shape of a single oxlint diagnostic in JSON output
 */
type OxlintDiagnostic = {
  readonly code?: string;
  readonly severity?: string;
  readonly message?: string;
  readonly labels?: readonly { readonly span?: { readonly line?: number; }; }[];
};

/**
 * Parsed oxlint result
 */
export type OxlintResult = {
  readonly errors: number;
  readonly warnings: number;
  readonly violationCount: number;
  readonly violatedRules: readonly string[];
  /**
   * Uncapped penalty contribution per rule, computed from per-rule violation
   * counts and severity. Used by combinedScore to apply a per-rule cap.
   */
  readonly perRulePenalty: ReadonlyMap<string, number>;
  readonly linterRan: boolean;
  readonly rawOutput: string;
};

//endregion Types

//region Parsing; converts raw JSON from oxlint --format json into structured OxlintResult

/**
 * Formats oxlint JSON diagnostics into human-readable lines for model feedback.
 *
 * @param diagnostics - parsed diagnostic objects
 *
 * @returns one-line-per-violation string
 */
function formatOxlintDiagnostics(diagnostics: readonly OxlintDiagnostic[],): string {
  return diagnostics
    .map(function formatDiag(diagnostic,): string {
      /**
       * Source line of the first label, or '?' when oxlint omits the span (e.g. file-level rules).
       */
      const line = diagnostic.labels?.[0]
        ?.span
        ?.line
        ?? '?';
      /**
       * Severity word for the human-readable line; defaults to 'error' so unset entries are conservatively flagged.
       */
      const severity = diagnostic.severity
        ?? 'error';
      /**
       * Rule identifier; falls back to 'unknown' for diagnostics that don't expose a code.
       */
      const code = diagnostic.code
        ?? 'unknown';
      /**
       * Diagnostic message body; empty string keeps the formatted line shape stable.
       */
      const message = diagnostic.message
        ?? '';
      return `line ${String(line,)}: ${severity} [${code}] ${message}`;
    },)
    .join('\n',);
}

/**
 * Parses oxlint JSON output, counting violations by severity.
 * @param jsonOutput - raw JSON string from oxlint --format json
 * @returns parsed result with severity breakdown and raw diagnostic text
 */
/**
 * Points deducted per lint error occurrence (before per-rule capping)
 */
const LINT_ERROR_PENALTY = 0.1;

/**
 * Points deducted per lint warning occurrence (before per-rule capping)
 */
const LINT_WARNING_PENALTY = 0.05;

/**
 * Parses oxlint JSON output, counting violations by severity.
 *
 * @param jsonOutput - raw JSON string from oxlint --format json
 *
 * @returns parsed result with severity breakdown and raw diagnostic text
 */
function parseOxlintJson(jsonOutput: string,): OxlintResult {
  try {
    /**
     * Top-level oxlint JSON envelope; only the `diagnostics` array is consumed downstream.
     */
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint JSON output has known structure
    const parsed = JSON.parse(jsonOutput.trim(),) as {
      diagnostics?: readonly OxlintDiagnostic[];
    };
    /**
     * Diagnostic list flattened from the envelope; empty when oxlint reported no violations.
     */
    const diagnostics = parsed.diagnostics
      ?? [];
    /**
     * Total diagnostics with severity 'error'; surfaced as `errors` on the parsed result.
     */
    const errors = diagnostics
      .filter(function isError(d,): boolean {
        return d.severity
          === 'error';
      },)
      .length;
    /**
     * Total diagnostics with severity 'warning'; surfaced as `warnings` on the parsed result.
     */
    const warnings = diagnostics
      .filter(function isWarning(d,): boolean {
        return d.severity
          === 'warning';
      },)
      .length;
    /**
     * Distinct rule IDs that appear in the diagnostics, minus the 'unknown' fallback.
     */
    const violatedRules = [
      ...new Set(diagnostics
        .map(function getCode(d,): string {
          return d.code
            ?? 'unknown';
        },)
        .filter(function notUnknown(code,): boolean {
          return code !== 'unknown';
        },),),
    ];

    // Compute uncapped penalty per rule from per-rule violation counts and severity
    /**
     * Rule name to uncapped penalty total; later capped per-rule by {@link combinedScore}.
     */
    const penaltyAccumulator = new Map<string, number>();
    diagnostics.forEach(function accumPenalty(diagnostic,): void {
      /**
       * Rule ID used as the accumulator key; 'unknown' bucket catches code-less diagnostics.
       */
      const rule = diagnostic.code
        ?? 'unknown';
      /**
       * Per-occurrence penalty; warnings cost less than errors.
       */
      const penaltyPerOccurrence = diagnostic.severity
        === 'warning'
        ? LINT_WARNING_PENALTY
        : LINT_ERROR_PENALTY;
      /**
       * Running penalty for this rule before adding the current occurrence.
       */
      const current = penaltyAccumulator.get(rule,)
        ?? 0;
      penaltyAccumulator.set(
        rule,
        current + penaltyPerOccurrence,
      );
    },);

    return {
      errors,
      warnings,
      violationCount: diagnostics.length,
      violatedRules,
      perRulePenalty: penaltyAccumulator,
      linterRan: true,
      rawOutput: formatOxlintDiagnostics(diagnostics,),
    };
  }
  catch (parseError) {
    /**
     * Lint-specific logger for oxlint parse failure.
     */
    const rl = tagged({
      tag: 'lint:oxlint',
      l,
    },);
    rl.error(`failed to parse JSON output: ${String(parseError,)}`,);
    return {
      errors: 0,
      warnings: 0,
      violationCount: 0,
      violatedRules: [],
      perRulePenalty: new Map(),
      linterRan: false,
      rawOutput: '',
    };
  }
}

//endregion Parsing

//region Runner: spawns oxlint, handles non-zero exits (oxlint exits 1 on violations), returns OxlintResult

/**
 * Runs oxlint --format json on a file, returns parsed severity breakdown.
 * oxlint exits non-zero on violations; stdout still contains valid JSON.
 *
 * @param filePath - absolute path to the file to lint
 *
 * @returns parsed oxlint result
 *
 * @example
 * ```ts
 * const result = await runAndParseOxlint('/path/to/canary.ts');
 * result.errors; // number of lint errors
 * ```
 */
export async function runAndParseOxlint(filePath: string,): Promise<OxlintResult> {
  try {
    /**
     * Raw oxlint stdout on success (zero violations); fed straight into the parser.
     */
    const output = await execPromise({
      command: 'oxlint',
      args: [
        '--format',
        'json',
        filePath,
      ],
      options: {
        timeout: LINT_TIMEOUT_MS,
      },
    },);
    return parseOxlintJson(output,);
  }
  catch (error) {
    // oxlint exits non-zero when there are lint errors; stdout still has valid JSON
    /**
     * Stdout recovered from the non-zero exit; still holds the diagnostics JSON when oxlint found violations.
     */
    const stdout = getStdoutFromError(error,);
    if (stdout.includes('"diagnostics"',))
      return parseOxlintJson(stdout,);
    /**
     * Lint-specific logger for oxlint execution failure.
     */
    const rl = tagged({
      tag: 'lint:oxlint',
      l,
    },);
    rl.error(`failed: ${String(error,)}`,);
    return {
      errors: 0,
      warnings: 0,
      violationCount: 0,
      violatedRules: [],
      perRulePenalty: new Map(),
      linterRan: false,
      rawOutput: '',
    };
  }
}

//endregion Runner
