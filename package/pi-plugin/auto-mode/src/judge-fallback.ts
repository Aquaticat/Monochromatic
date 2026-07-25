/**
 * Auto-mode adapter over shared reviewer availability fallback.
 *
 * @module
 */

import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import { runReviewWithFallback, } from '@monochromatic-dev/pi-shared-model-review/ts';

import { NoBudgetModelError, } from './budget-model-error.ts';
import { budgetModelSlug, } from './budget-model-identity.ts';
import type {
  BudgetModel,
  Verdict,
} from './types.ts';

/**
 * Immutable judge subset passed to complete attempts.
 *
 * @example
 * ```ts
 * const candidate: JudgeAttemptCandidate = { model, auth };
 * ```
 */
type JudgeAttemptCandidate = {
  /**
   * Selected judge model.
   */
  readonly model: Readonly<BudgetModel['model']>;
  /**
   * Resolved judge credentials.
   */
  readonly auth: Readonly<BudgetModel['auth']>;
};

/**
 * Complete attempt capability shared by initial and fallback reviewers.
 *
 * @example
 * ```ts
 * const attempt: JudgeAttempt = async ({ judge }) => callJudge(judge);
 * ```
 */
type JudgeAttempt = (
  options: { readonly judge: JudgeAttemptCandidate; },
) => Promise<Verdict>;

/**
 * Run initial auto-mode judge then shared bounded availability fallback.
 *
 * @param firstJudge - initially selected authenticated judge
 *
 * @param resolveFallbackJudge - resolver honoring completed-attempt exclusions
 *
 * @param callJudgeAttempt - complete transport attempt for one judge
 *
 * @returns first valid auto-mode verdict
 *
 * @mutates resolveFallbackJudge - resolver capability may change captured state
 *
 * @mutates callJudgeAttempt - attempt capability may change captured state
 *
 * @example
 * ```ts
 * const verdict = await callJudgeWithFallback({ firstJudge, resolveFallbackJudge, callJudgeAttempt });
 * ```
 */
async function callJudgeWithFallback(
  {
    firstJudge,
    resolveFallbackJudge,
    callJudgeAttempt,
  }: {
    readonly firstJudge: BudgetModel;
    readonly resolveFallbackJudge: ForeignBorrowed<(
      options: { readonly excludedModelSlugs: readonly string[]; },
    ) => Promise<BudgetModel>>;
    readonly callJudgeAttempt: ForeignBorrowed<JudgeAttempt>;
  },
): Promise<Verdict> {
  /**
   * Shared fallback result carrying winner metadata not needed by auto-mode.
   */
  const result = await runReviewWithFallback<JudgeAttemptCandidate, Verdict>({
    firstCandidate: firstJudge,
    candidateIdentity(candidate,) {
      return budgetModelSlug(candidate.model,);
    },
    resolveFallback({ excludedCandidateIdentities, },) {
      return resolveFallbackJudge({
        excludedModelSlugs: excludedCandidateIdentities,
      },);
    },
    runAttempt({ candidate, },) {
      return callJudgeAttempt({ judge: candidate, },);
    },
    isCandidateUnavailable(error,) {
      return error instanceof NoBudgetModelError;
    },
  },);
  return result.verdict;
}

export { callJudgeWithFallback, };
