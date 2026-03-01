/**
 * Combined scoring for code-generation probes.
 *
 * Correctness is a hard gate: any correctness error zeroes the entire score.
 * When correctness is perfect (1.0), the score starts at 1.0 and each
 * quality issue applies a flat penalty:
 * - Lint error: -0.1 per occurrence
 * - Type error: -0.1 per occurrence
 * - Lint warning: -0.05 per occurrence
 *
 * Final score is clamped to [0, 1].
 */
import { lintSource, } from '../linter.ts';

import { extractCode, } from './extract-code.ts';

import type { LintResult, } from '../linter.ts';
import type { ScoreContext, } from '../probes.ts';

//region Scoring penalties -- flat per-issue deductions applied when correctness is perfect

/** Points deducted per lint error reported by oxlint */
const LINT_ERROR_PENALTY = 0.1;

/** Points deducted per type error reported by tsgo */
const TYPE_ERROR_PENALTY = 0.1;

/** Points deducted per lint warning reported by oxlint */
const LINT_WARNING_PENALTY = 0.05;

//endregion Scoring penalties

/**
 * Combines correctness, lint quality, and type safety into a final score.
 *
 * Any correctness failure (score below 1.0) zeroes the entire result.
 * Otherwise deducts flat penalties per lint error, type error, and lint warning.
 *
 * @param correctness - 0-1 score from output verification; must be exactly 1.0 to earn points
 * @param lint - full lint result with severity breakdown and type errors
 * @returns combined score clamped to [0, 1]
 *
 * @example
 * ```ts
 * // Perfect correctness, 2 lint errors, 1 type error, 3 warnings
 * // score = 1.0 - (2 * 0.1) - (1 * 0.1) - (3 * 0.05) = 0.55
 * combinedScore(1.0, lint);
 * ```
 */
export function combinedScore(correctness: number, lint: LintResult): number {
  if (correctness < 1) return 0;
  const penalty = (lint.severity.errors * LINT_ERROR_PENALTY)
    + (lint.typeErrors * TYPE_ERROR_PENALTY)
    + (lint.severity.warnings * LINT_WARNING_PENALTY);
  return Math.max(0, 1 - penalty);
}

/**
 * Runs oxlint and tsgo on generated source and logs results per probe.
 * @param source - TypeScript source to analyze
 * @param probeName - probe name for log prefixes
 * @param context - model identity and pass for artifact organization
 * @returns full lint result for scoring
 */
export async function lintAndLog(source: string, probeName: string, context: ScoreContext): Promise<LintResult> {
  const lint = await lintSource(source, {
    model: context.modelId,
    probe: probeName,
    pass: context.pass,
    timestamp: new Date().toISOString(),
  });
  if (lint.linterRan || lint.typeCheckerRan) {
    const lintSummary = lint.linterRan
      ? `lint=${String(lint.severity.errors)}err/${String(lint.severity.warnings)}warn`
      : 'lint=skipped';
    const typeSummary = lint.typeCheckerRan
      ? `type=${String(lint.typeErrors)}err`
      : 'type=skipped';
    const rulesSummary = lint.violatedRules.length > 0
      ? ` (${lint.violatedRules.slice(0, 5).join(', ')})`
      : '';
    console.log(`    [${context.modelId}:${probeName}] ${lintSummary} ${typeSummary}${rulesSummary}`);
  }
  return lint;
}

export { extractCode, } from './extract-code.ts';
export { buildCodeGenFixPrompt, } from './fix-prompt.ts';
