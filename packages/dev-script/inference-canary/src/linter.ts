/**
 * Runs the monorepo's oxlint and tsgo against generated code on the host.
 *
 * Two quality dimensions are measured:
 * - **Lint violations** (oxlint -D all): style and correctness rules, split by severity
 * - **Type errors** (tsgo --noEmit): type safety using the monorepo's strict tsconfig
 *
 * Both are early degradation signals -- code quality degrades before correctness does.
 */
import { execFile, } from 'node:child_process';
import { mkdir, rm, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

//region Types

/** Oxlint diagnostic severity levels */
export type Severity = 'error' | 'warning';

/** Violation counts broken down by severity */
export type SeverityCounts = {
  readonly errors: number;
  readonly warnings: number;
};

/** Result of linting and type-checking generated code */
export type LintResult = {
  /** Violation counts by severity level */
  readonly severity: SeverityCounts;
  /** Total violation count (errors + warnings) */
  readonly violationCount: number;
  /** Unique rule IDs that were violated, for diagnostic reporting */
  readonly violatedRules: readonly string[];
  /** Number of TypeScript type errors from tsgo */
  readonly typeErrors: number;
  /** Whether oxlint executed successfully (not whether code is clean) */
  readonly linterRan: boolean;
  /** Whether tsgo executed successfully */
  readonly typeCheckerRan: boolean;
  /**
   * Raw diagnostic text from oxlint and tsgo, suitable for feeding back
   * to the model in a second pass. Empty if neither tool ran.
   */
  readonly rawDiagnostics: string;
};

//endregion Types

//region Shared paths

/**
 * Canary lint artifact directory. Lives under src/ so both tsgo (via the
 * package tsconfig's `src/**\/*.ts` include) and oxlint pick it up without
 * any config overrides. No leading dot because TS globs skip dotdirs.
 * Gitignored via the package .gitignore.
 */
const PACKAGE_DIR = new URL('..', import.meta.url).pathname;
const LINT_DIR = join(PACKAGE_DIR, 'src', 'canary-lint');

/** Metadata written alongside each generated canary.ts for traceability */
type ArtifactMeta = {
  readonly model: string;
  readonly probe: string;
  readonly pass: 'initial' | 'fix';
  readonly timestamp: string;
};

/**
 * Extracts the short model name from an OpenRouter model ID.
 * "anthropic/claude-sonnet-4.6" -> "claude-sonnet-4.6"
 * @param modelId - full OpenRouter model ID
 * @returns short slug suitable for directory names
 */
function modelSlug(modelId: string): string {
  return modelId.split('/').pop() ?? modelId;
}

/**
 * Creates a lint artifact directory organized by model and probe.
 *
 * Directory structure: `src/canary-lint/<model-slug>/<probe>-<pass>/canary.ts`
 * A `meta.json` is written alongside for future viewer tools.
 *
 * @param source - TypeScript source to analyze
 * @param meta - artifact metadata (model, probe, pass, timestamp)
 * @returns object with file path and subdirectory path
 */
async function writeLintFile(source: string, meta: ArtifactMeta): Promise<{
  filePath: string;
  lintDir: string;
}> {
  const slug = modelSlug(meta.model);
  const lintDir = join(LINT_DIR, slug, `${meta.probe}-${meta.pass}`);
  await mkdir(lintDir, { recursive: true, });
  const filePath = join(lintDir, 'canary.ts');
  await Promise.all([
    writeFile(filePath, source, 'utf8'),
    writeFile(join(lintDir, 'meta.json'), JSON.stringify(meta, null, 2), 'utf8'),
  ]);
  return { filePath, lintDir, };
}

/**
 * Removes a specific lint artifact directory after analysis.
 * @param lintDir - absolute path to the lint directory to clean up
 */
async function cleanupLintDir(lintDir: string): Promise<void> {
  await rm(lintDir, { recursive: true, force: true, });
}

//endregion Shared paths

//region Public API

/**
 * Runs both oxlint and tsgo on generated source, returns combined results.
 *
 * Uses the project's oxlint config and the canary-specific tsconfig for type
 * checking (inherits the monorepo's strict settings).
 *
 * Generated source is written to `src/canary-lint/<model>/<probe>-<pass>/canary.ts`
 * with a `meta.json` sidecar for traceability.
 *
 * @param source - TypeScript source code to analyze
 * @param meta - artifact metadata for directory naming and traceability
 * @returns combined lint + type-check results
 */
export async function lintSource(source: string, meta: ArtifactMeta): Promise<LintResult> {
  const { filePath, lintDir, } = await writeLintFile(source, meta);

  try {
    const [oxlintResult, typeResult] = await Promise.all([
      runAndParseOxlint(filePath),
      runAndParseTypeCheck(lintDir),
    ]);

    const rawParts: string[] = [];
    if (oxlintResult.rawOutput.length > 0) rawParts.push(`=== oxlint ===\n${oxlintResult.rawOutput}`);
    if (typeResult.rawOutput.length > 0) rawParts.push(`=== tsgo ===\n${typeResult.rawOutput}`);

    return {
      severity: oxlintResult.severity,
      violationCount: oxlintResult.violationCount,
      violatedRules: oxlintResult.violatedRules,
      typeErrors: typeResult.errorCount,
      linterRan: oxlintResult.linterRan,
      typeCheckerRan: typeResult.ran,
      rawDiagnostics: rawParts.join('\n\n'),
    };
  } catch (error) {
    console.log(`    [lint] analysis failed: ${String(error)}`);
    return {
      severity: { errors: 0, warnings: 0, },
      violationCount: 0,
      violatedRules: [],
      typeErrors: 0,
      linterRan: false,
      typeCheckerRan: false,
      rawDiagnostics: '',
    };
  } finally {
    // Lint dirs are intentionally kept -- useful for debugging and don't accumulate
    // enough to matter (gitignored via src/canary-lint-*/)
  }
}

//endregion Public API

//region Oxlint

/**
 * Runs oxlint and parses the JSON output into a structured result.
 * @param filePath - absolute path to the file to lint
 * @returns parsed oxlint result with severity breakdown
 */
async function runAndParseOxlint(filePath: string): Promise<{
  severity: SeverityCounts;
  violationCount: number;
  violatedRules: readonly string[];
  linterRan: boolean;
  rawOutput: string;
}> {
  try {
    // No extra flags -- the root .oxlintrc.json already configures categories,
    // plugins, and per-rule severity. Errors vs warnings reflect real project intent.
    const output = await execPromise(
      'oxlint',
      ['--format', 'json', filePath],
    );
    return parseOxlintJson(output);
  } catch (error) {
    // oxlint exits non-zero when there are lint errors; stdout still has valid JSON
    const stdout = error instanceof Error && 'stdout' in error
      ? String((error as { stdout: unknown }).stdout)
      : '';
    if (stdout.includes('"diagnostics"')) {
      return parseOxlintJson(stdout);
    }
    console.log(`    [lint:oxlint] failed: ${String(error)}`);
    return {
      severity: { errors: 0, warnings: 0, },
      violationCount: 0,
      violatedRules: [],
      linterRan: false,
      rawOutput: '',
    };
  }
}

/** Shape of a single oxlint diagnostic in JSON output */
type OxlintDiagnostic = {
  readonly code?: string;
  readonly severity?: string;
  readonly message?: string;
  readonly labels?: ReadonlyArray<{ readonly span?: { readonly line?: number } }>;
};

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
function parseOxlintJson(jsonOutput: string): {
  severity: SeverityCounts;
  violationCount: number;
  violatedRules: readonly string[];
  linterRan: boolean;
  rawOutput: string;
} {
  try {
    const parsed = JSON.parse(jsonOutput.trim()) as {
      diagnostics?: readonly OxlintDiagnostic[];
    };

    const diagnostics = parsed.diagnostics ?? [];

    const errors = diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'error',
    ).length;
    const warnings = diagnostics.filter(
      (diagnostic) => diagnostic.severity === 'warning',
    ).length;

    const violatedRules = [
      ...new Set(
        diagnostics
          .map((diagnostic) => diagnostic.code ?? 'unknown')
          .filter((code) => code !== 'unknown'),
      ),
    ];

    return {
      severity: { errors, warnings, },
      violationCount: diagnostics.length,
      violatedRules,
      linterRan: true,
      rawOutput: formatOxlintDiagnostics(diagnostics),
    };
  } catch {
    return {
      severity: { errors: 0, warnings: 0, },
      violationCount: 0,
      violatedRules: [],
      linterRan: false,
      rawOutput: '',
    };
  }
}

//endregion Oxlint

//region Type checking

/**
 * Runs tsgo --noEmit on the package's tsconfig, which covers src/canary-lint/
 * via the inherited `src/**\/*.ts` include pattern.
 * Counts only type errors from the specific lint subdirectory.
 * @param lintDir - absolute path to the lint subdirectory for this probe
 * @returns error count and whether tsgo ran successfully
 */
async function runAndParseTypeCheck(lintDir: string): Promise<{
  errorCount: number;
  ran: boolean;
  rawOutput: string;
}> {
  /** Filter pattern: "canary-lint/<model>/<probe>-<pass>/canary.ts" uniquely identifies this probe's file */
  const relativeSuffix = lintDir.split('canary-lint/').pop() ?? '';

  try {
    /** Separate tsconfig that only includes src/canary-lint/ to avoid polluting the package lint */
    const canaryTsconfig = join(PACKAGE_DIR, 'tsconfig.canary-lint.json');
    const output = await execPromise(
      'tsgo',
      ['--noEmit', '-p', canaryTsconfig],
    );
    const filtered = filterTypeErrors(output, relativeSuffix);
    return { errorCount: filtered.length, ran: true, rawOutput: filtered.join('\n'), };
  } catch (error) {
    // tsgo exits non-zero when there are type errors; stdout has the diagnostics
    const stdout = error instanceof Error && 'stdout' in error
      ? String((error as { stdout: unknown }).stdout)
      : '';

    if (stdout.includes('error TS')) {
      const filtered = filterTypeErrors(stdout, relativeSuffix);
      return { errorCount: filtered.length, ran: true, rawOutput: filtered.join('\n'), };
    }

    console.log(`    [lint:tsgo] failed: ${String(error)}`);
    return { errorCount: 0, ran: false, rawOutput: '', };
  }
}

/**
 * Extracts type error lines from a specific canary lint subdirectory only,
 * ignoring noise from bun-types, other project files, or other probe runs.
 * @param output - raw tsgo output
 * @param subdirId - subdirectory label within canary-lint/ (e.g. "css-mixin", "csv-rfc4180-2")
 * @returns error lines from that subdirectory's canary.ts
 */
function filterTypeErrors(output: string, subdirId: string): readonly string[] {
  const marker = `canary-lint/${subdirId}/canary.ts`;
  return output.split('\n')
    .filter((line) => line.includes(marker) && line.includes('error TS'));
}

//endregion Type checking

//region Helpers

/**
 * Promisified execFile with timeout.
 * @param command - command to run
 * @param args - command arguments
 * @returns stdout string
 */
function execPromise(command: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024, },
      (error, stdout) => {
        if (error !== null) {
          // Attach stdout to error for callers that need it
          Object.assign(error, { stdout, });
          reject(error);
          return;
        }
        resolve(String(stdout));
      },
    );
  });
}

//endregion Helpers
