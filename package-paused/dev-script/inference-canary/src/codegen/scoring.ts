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
 * 0.3, not 2.5; the model missed one convention, not twenty different ones.
 *
 * Final score is clamped to [0, 1].
 */
import {
  type LintResult,
  lintSource,
} from '../linter.ts';
import {
  l,
  tagged,
} from '../log.ts';

import { extractCode, } from './extract-code.ts';

import type { ScoreContext, } from '../probes.ts';

//region Scoring penalties

/**
 * Points deducted per type error reported by tsgo
 */
const TYPE_ERROR_PENALTY = 0.1;

/**
 * Maximum penalty any single lint rule can contribute
 */
const MAX_PENALTY_PER_RULE = 0.3;

/**
 * Maximum number of violated rules to display in the log summary
 */
const MAX_DISPLAYED_RULES = 5;

//endregion Scoring penalties

/**
 * Options for {@link combinedScore}.
 *
 * @example
 * ```ts
 * const options: CombinedScoreOptions = {
 *   correctness: 1.0,
 *   lint: lintResult,
 * };
 * ```
 */
type CombinedScoreOptions = {
  /**
   * 0-1 score from output verification; must be exactly 1.0 to earn points
   */
  readonly correctness: number;
  /**
   * Full lint result with per-rule penalty map and type errors
   */
  readonly lint: LintResult;
};

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
 * combinedScore({ correctness: 1.0, lint });
 * ```
 */
export function combinedScore({
  correctness,
  lint,
}: CombinedScoreOptions,): number {
  if (correctness < 1)
    return 0;

  /**
   * Total lint penalty after capping each rule at `MAX_PENALTY_PER_RULE`; subtracted from the perfect-score baseline.
   */
  const lintPenalty = [...lint.perRulePenalty
    .values(),]
    .reduce(
      function capAndSum(
        sum,
        uncapped,
      ): number {
        return sum + Math
          .min(
          uncapped,
          MAX_PENALTY_PER_RULE,
        );
      },
      0,
    );

  /**
   * Flat per-error penalty for tsgo diagnostics; no cap since each type error is treated as distinct.
   */
  const typePenalty = lint.typeErrors
    * TYPE_ERROR_PENALTY;
  return Math.max(
    0,
    1 - lintPenalty
      - typePenalty,
  );
}

/**
 * Options for {@link lintAndLog}.
 *
 * @example
 * ```ts
 * const options: LintAndLogOptions = {
 *   source: 'console.log(1);',
 *   probeName: 'sudoku-solver',
 *   context: scoreContext,
 * };
 * ```
 */
type LintAndLogOptions = {
  /**
   * TypeScript source to analyze
   */
  readonly source: string;
  /**
   * Probe name for log prefixes
   */
  readonly probeName: string;
  /**
   * Model identity and pass for artifact organization
   */
  readonly context: ScoreContext;
};

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
 *
 * @example
 * ```ts
 * const lint = await lintAndLog({ source, probeName: 'sudoku-solver', context });
 * lint.violationCount; // total violations
 * ```
 */
export async function lintAndLog({
  source,
  probeName,
  context,
}: LintAndLogOptions,): Promise<LintResult> {
  /**
   * Full lint result returned to callers; also drives the per-probe log summary below.
   */
  const lint = await lintSource({
    source,
    meta: {
      model: context.label,
      label: context.label,
      probe: probeName,
      pass: context.pass,
      timestamp: context.timestamp,
    },
  },);
  if (lint.linterRan
    || lint
    .typeCheckerRan) {
    /**
     * Probe-specific logger for lint result summary.
     */
    const rl = tagged({
      tag: probeName,
      l: tagged({
        tag: context.label,
        l,
      },),
    },);
    /**
     * Oxlint portion of the one-line log summary; "skipped" when the linter never ran.
     */
    const lintSummary = lint.linterRan
      ? `lint=${String(lint.severity
        .errors,)}err/${String(lint.severity
          .warnings,)}warn`
      : 'lint=skipped';
    /**
     * Tsgo portion of the one-line log summary; "skipped" when the type checker never ran.
     */
    const typeSummary = lint.typeCheckerRan
      ? `type=${String(lint.typeErrors,)}err`
      : 'type=skipped';
    /**
     * Top `MAX_DISPLAYED_RULES` violated rule IDs in a parenthetical; empty when nothing violated.
     */
    const rulesSummary = lint.violatedRules
      .length
      > 0
      ? ` (${
        lint
          .violatedRules
          .slice(
            0,
            MAX_DISPLAYED_RULES,
          )
          .join(', ',)
      })`
      : '';
    rl.info(`${lintSummary} ${typeSummary}${rulesSummary}`,);
  }
  return lint;
}

export {
  extractCode,
  tryExtractCode,
} from './extract-code.ts';
export { buildCodeGenFixPrompt, } from './fix-prompt.ts';
