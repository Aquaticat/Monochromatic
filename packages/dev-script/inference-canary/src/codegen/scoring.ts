/**
 * Combined scoring for code-generation probes.
 *
 * Correctness is a hard gate: any correctness error zeroes the entire score.
 * When correctness is perfect (1.0), the score starts at 1.0 and quality issues
 * apply penalties:
 * - Lint error: -0.1 per occurrence, capped at 0.3 per rule
 * - Lint warning: -0.05 per occurrence, capped at 0.3 per rule
 * - Type error: -0.1 per occurrence (no per-rule cap; tsgo errors are distinct)
 *
 * The per-rule cap prevents one systematically violated rule (e.g. require-tsdoc
 * on every declaration) from dominating the score. Forgetting TSDoc costs at most
 * 0.3, not 2.5 -- the model missed one convention, not twenty different ones.
 *
 * Final score is clamped to [0, 1].
 */
import {
  type LintResult,
  lintSource,
} from '../linter.ts';

import { extractCode, } from './extract-code.ts';

import type { ScoreContext, } from '../probes.ts';

//region Scoring penalties

/** Points deducted per type error reported by tsgo */
const TYPE_ERROR_PENALTY = 0.1;

/** Maximum penalty any single lint rule can contribute */
const MAX_PENALTY_PER_RULE = 0.3;

/** Maximum number of violated rules to display in the log summary */
const MAX_DISPLAYED_RULES = 5;

//endregion Scoring penalties

/**
 * Combines correctness, lint quality, and type safety into a final score.
 *
 * Any correctness failure (score below 1.0) zeroes the entire result.
 * Otherwise deducts capped per-rule lint penalties and flat type error penalties.
 *
 * @param correctness - 0-1 score from output verification; must be exactly 1.0 to earn points
 *
 * @param lint - full lint result with per-rule penalty map and type errors
 *
 * @returns combined score clamped to [0, 1]
 *
 * @example
 * ```ts
 * // Perfect correctness, require-tsdoc violated 20 times (uncapped 2.0, capped 0.3),
 * // one other error (0.1), 2 type errors (0.2)
 * // score = 1.0 - 0.3 - 0.1 - 0.2 = 0.4
 * combinedScore(1.0, lint);
 * ```
 */
export function combinedScore(correctness: number, lint: LintResult,): number {
  if (correctness < 1)
    return 0;

  // Sum lint penalties with per-rule cap
  const lintPenalty = [...lint.perRulePenalty.values(),]
    .reduce(function capAndSum(sum, uncapped,): number {
      return sum + Math.min(uncapped, MAX_PENALTY_PER_RULE,);
    }, 0,);

  const typePenalty = lint.typeErrors * TYPE_ERROR_PENALTY;
  return Math.max(0, 1 - lintPenalty - typePenalty,);
}

/**
 * Runs oxlint and tsgo on generated source and logs results per probe.
 *
 * @param source - TypeScript source to analyze
 *
 * @param probeName - probe name for log prefixes
 *
 * @param context - model identity and pass for artifact organization
 *
 * @returns full lint result for scoring
 */
export async function lintAndLog(source: string, probeName: string,
  context: ScoreContext,): Promise<LintResult>
{
  const lint = await lintSource(source, {
    model: context.label,
    label: context.label,
    probe: probeName,
    pass: context.pass,
    timestamp: context.timestamp,
  },);
  if (lint.linterRan || lint.typeCheckerRan) {
    const lintSummary = lint.linterRan
      ? `lint=${String(lint.severity.errors,)}err/${String(lint.severity.warnings,)}warn`
      : 'lint=skipped';
    const typeSummary = lint.typeCheckerRan
      ? `type=${String(lint.typeErrors,)}err`
      : 'type=skipped';
    const rulesSummary = lint.violatedRules.length > 0
      ? ` (${lint.violatedRules.slice(0, MAX_DISPLAYED_RULES,).join(', ',)})`
      : '';
    console.log(
      `    [${context.label}:${probeName}] ${lintSummary} ${typeSummary}${rulesSummary}`,
    );
  }
  return lint;
}

export {
  extractCode,
  tryExtractCode,
} from './extract-code.ts';
export { buildCodeGenFixPrompt, } from './fix-prompt.ts';
