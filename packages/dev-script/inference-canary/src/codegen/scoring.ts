/**
 * Combined scoring for code-generation probes.
 *
 * Merges three dimensions into a single 0-1 score:
 * - Correctness (40%): container output matches expected
 * - Lint quality (30%): oxlint violations, errors weighted 3x warnings
 * - Type safety (30%): tsgo type errors
 */
import { lintSource, } from '../linter.ts';

import { extractCode, } from './extract-code.ts';

import type { LintResult, } from '../linter.ts';
import type { ScoreContext, } from '../probes.ts';

//region Scoring weights and ceilings

/** Correctness accounts for 40% of the score -- does the code produce correct output? */
const CORRECTNESS_WEIGHT = 0.4;

/** Lint quality accounts for 30% -- does the code follow project style rules? */
const LINT_WEIGHT = 0.3;

/** Type safety accounts for 30% -- does the code satisfy the strict tsconfig? */
const TYPE_WEIGHT = 0.3;

/** Lint errors are weighted 3x warnings because errors indicate correctness issues */
const ERROR_MULTIPLIER = 3;

/**
 * Weighted lint violation count at which the lint score becomes 0.
 * A healthy model produces ~30 warnings and ~10 errors; ceiling at 100 gives headroom.
 */
const LINT_WEIGHTED_CEILING = 100;

/**
 * Number of type errors at which the type score becomes 0.
 * Generated code is standalone, so a healthy model should produce few type errors.
 */
const TYPE_ERROR_CEILING = 20;

//endregion Scoring weights and ceilings

/**
 * Combines correctness, lint quality, and type safety into a final score.
 * @param correctness - 0-1 score from output verification
 * @param lint - full lint result with severity breakdown and type errors
 * @returns weighted combined score
 */
export function combinedScore(correctness: number, lint: LintResult): number {
  const weightedViolations = (lint.severity.errors * ERROR_MULTIPLIER) + lint.severity.warnings;
  const lintScore = Math.max(0, 1 - (weightedViolations / LINT_WEIGHTED_CEILING));
  const typeScore = Math.max(0, 1 - (lint.typeErrors / TYPE_ERROR_CEILING));
  return (correctness * CORRECTNESS_WEIGHT) + (lintScore * LINT_WEIGHT) + (typeScore * TYPE_WEIGHT);
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
  if (lint.linterRan) {
    console.log(
      `    [lint:${probeName}] errors=${String(lint.severity.errors)}`
      + ` warnings=${String(lint.severity.warnings)}`
      + ` rules=[${lint.violatedRules.slice(0, 5).join(', ')}]`,
    );
  }
  if (lint.typeCheckerRan) console.log(`    [type:${probeName}] errors=${String(lint.typeErrors)}`);
  return lint;
}

export { extractCode, } from './extract-code.ts';
export { buildCodeGenFixPrompt, } from './fix-prompt.ts';
