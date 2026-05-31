/**
 * Public API for linting and type-checking generated model output.
 *
 * Two quality dimensions are measured:
 * - **Lint violations** (oxlint -D all): style and correctness rules, split by severity
 * - **Type errors** (tsgo --noEmit): type safety using the monorepo's strict tsconfig
 *
 * Both are early degradation signals; code quality degrades before correctness does.
 */
import { writeLintFile, } from './linter-artifacts.ts';
import { runAndParseOxlint, } from './linter-oxlint.ts';
import { runAndParseTypeCheck, } from './linter-tsgo.ts';

// oxlint-disable-next-line no-duplicate-imports -- re-export requires a separate import for local use
import type { ArtifactMeta, } from './linter-artifacts.ts';

export type { ArtifactMeta, } from './linter-artifacts.ts';

//region Types: severity counts, lint result, and related types consumed by codegen probes

/**
 * Oxlint diagnostic severity levels
 */
export type Severity = 'error' | 'warning';

/**
 * Violation counts broken down by severity
 */
export type SeverityCounts = {
  readonly errors: number;
  readonly warnings: number;
};

/**
 * Result of linting and type-checking generated code
 */
export type LintResult = {
  /**
   * Violation counts by severity level
   */
  readonly severity: SeverityCounts;
  /**
   * Total violation count (errors + warnings)
   */
  readonly violationCount: number;
  /**
   * Unique rule IDs that were violated, for diagnostic reporting
   */
  readonly violatedRules: readonly string[];
  /**
   * Uncapped penalty contribution per rule (e.g. 20 require-tsdoc errors = 2.0).
   * combinedScore applies a per-rule cap to prevent one repeated rule from
   * dominating the score.
   */
  readonly perRulePenalty: ReadonlyMap<string, number>;
  /**
   * Number of TypeScript type errors from tsgo
   */
  readonly typeErrors: number;
  /**
   * Whether oxlint executed successfully (not whether code is clean)
   */
  readonly linterRan: boolean;
  /**
   * Whether tsgo executed successfully
   */
  readonly typeCheckerRan: boolean;
  /**
   * Raw diagnostic text from oxlint and tsgo, suitable for feeding back
   * to the model in a second pass. Empty if neither tool ran.
   */
  readonly rawDiagnostics: string;
};

//endregion Types

//region Public API: lintSource is the sole entry point; writes artifact, runs oxlint + tsgo, returns combined result

/**
 * Options for {@link lintSource}.
 *
 * @example
 * ```ts
 * const opts: LintSourceOptions = {
 *   source: 'const x: number = 1;',
 *   meta: { label: 'Opus 4.6', probe: 'sum', pass: 'initial', timestamp: '2026-03-06T12:00:00.000Z' },
 * };
 * ```
 */
export type LintSourceOptions = {
  /**
   * TypeScript source code to analyze
   */
  readonly source: string;
  /**
   * Artifact metadata for directory naming and traceability
   */
  readonly meta: ArtifactMeta;
};

/**
 * Runs both oxlint and tsgo on generated source, returns combined results.
 *
 * Generated source is written to `src/canary-lint/<model>/<probe>-<pass>-<timestamp>/canary.ts`
 * with a `meta.json` sidecar for traceability. Artifact directories are kept after
 * runs for debugging (gitignored, do not accumulate meaningfully).
 *
 * @param source - TypeScript source code to analyze
 *
 * @param meta - artifact metadata for directory naming and traceability
 *
 * @returns combined lint + type-check results
 *
 * @example
 * ```ts
 * const result = await lintSource({ source: 'const x: number = 1;', meta });
 * result.violationCount; // total lint violations
 * ```
 */
export async function lintSource({
  source,
  meta,
}: LintSourceOptions,): Promise<LintResult> {
  /**
   * Artifact file path and its enclosing lint directory; passed to the two analyzers below.
   */
  const {
    filePath,
    lintDir,
  } = await writeLintFile({
    source,
    meta,
  },);

  // runAndParseOxlint and runAndParseTypeCheck each catch their own errors and
  // return safe defaults, so no outer catch is needed here.
  /**
   * Oxlint and tsgo results awaited together; merged below into the returned `LintResult`.
   */
  const [oxlintResult, typeResult,] = await Promise.all([
    runAndParseOxlint(filePath,),
    runAndParseTypeCheck(lintDir,),
  ],);

  /**
   * Non-empty diagnostic sections from each analyzer; joined for the model-facing `rawDiagnostics` field.
   */
  const rawParts = [
    oxlintResult.rawOutput
      .length
      > 0 ? `=== oxlint ===\n${oxlintResult.rawOutput}` : '',
    typeResult.rawOutput
      .length
      > 0 ? `=== tsgo ===\n${typeResult.rawOutput}` : '',
  ]
    .filter(function hasContent(part,): boolean {
      return part.length
        > 0;
    },);

  return {
    severity: {
      errors: oxlintResult.errors,
      warnings: oxlintResult.warnings,
    },
    violationCount: oxlintResult.violationCount,
    violatedRules: oxlintResult.violatedRules,
    perRulePenalty: oxlintResult.perRulePenalty,
    typeErrors: typeResult.errorCount,
    linterRan: oxlintResult.linterRan,
    typeCheckerRan: typeResult.ran,
    rawDiagnostics: rawParts.join('\n\n',),
  };
}

//endregion Public API
