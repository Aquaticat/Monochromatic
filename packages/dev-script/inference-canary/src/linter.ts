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
const LINT_BASE = join(PACKAGE_DIR, 'src', 'canary-lint');

/** Monotonic counter for unique lint directories (safe for parallel calls) */
let lintDirCounter = 0;

/**
 * Creates a unique lint directory and writes source into it.
 * Each call gets its own directory so parallel probes don't clobber each other.
 * @param source - TypeScript source to analyze
 * @returns object with file path and cleanup function
 */
async function writeLintFile(source: string): Promise<{
  filePath: string;
  lintDir: string;
}> {
  lintDirCounter += 1;
  const lintDir = `${LINT_BASE}-${String(lintDirCounter)}`;
  await mkdir(lintDir, { recursive: true, });
  const filePath = join(lintDir, 'canary.ts');
  await writeFile(filePath, source, 'utf8');
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
 * Uses `-D all` for oxlint (every rule category enabled) and the package's
 * tsconfig for type checking (inherits the monorepo's strict settings).
 *
 * @param source - TypeScript source code to analyze
 * @returns combined lint + type-check results
 */
export async function lintSource(source: string): Promise<LintResult> {
  const { filePath, lintDir, } = await writeLintFile(source);

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
    await cleanupLintDir(lintDir);
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
 * Runs tsgo --noEmit on the package's tsconfig, which covers src/canary-lint-*\/
 * via the inherited `src/**\/*.ts` include pattern.
 * Counts only type errors from the specific lint directory.
 * @param lintDir - absolute path to the lint directory for this probe
 * @returns error count and whether tsgo ran successfully
 */
async function runAndParseTypeCheck(lintDir: string): Promise<{
  errorCount: number;
  ran: boolean;
  rawOutput: string;
}> {
  /** Directory basename used to filter tsgo output to just this probe's file */
  const dirName = lintDir.split('/').pop() ?? 'canary-lint';

  try {
    const output = await execPromise(
      'tsgo',
      ['--noEmit', '-p', join(PACKAGE_DIR, 'tsconfig.json')],
    );
    const filtered = filterTypeErrors(output, dirName);
    return { errorCount: filtered.length, ran: true, rawOutput: filtered.join('\n'), };
  } catch (error) {
    // tsgo exits non-zero when there are type errors; stdout has the diagnostics
    const stdout = error instanceof Error && 'stdout' in error
      ? String((error as { stdout: unknown }).stdout)
      : '';

    if (stdout.includes('error TS')) {
      const filtered = filterTypeErrors(stdout, dirName);
      return { errorCount: filtered.length, ran: true, rawOutput: filtered.join('\n'), };
    }

    console.log(`    [lint:tsgo] failed: ${String(error)}`);
    return { errorCount: 0, ran: false, rawOutput: '', };
  }
}

/**
 * Extracts type error lines from a specific canary lint directory only,
 * ignoring noise from bun-types, other project files, or other probe runs.
 * @param output - raw tsgo output
 * @param dirName - directory name to filter for (e.g. "canary-lint-1")
 * @returns error lines from that directory's canary.ts
 */
function filterTypeErrors(output: string, dirName: string): readonly string[] {
  return output.split('\n')
    .filter((line) => line.includes(`${dirName}/canary.ts`) && line.includes('error TS'));
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
