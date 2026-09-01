// PROTOTYPE ONLY: Candidate M exact challenge caller guard.

import { isJsonRecord, } from './json-guard.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import { diagnoseRiskFinding, } from './prototype-risk-challenger-evidence.ts';
import type {
  CandidateMChallengeDiagnosis,
  CandidateMChallengeResponse,
  CandidateMChallengerRole,
  CandidateMCandidate,
} from './prototype-risk-challenger-model.ts';

/**
 * Diagnoses Candidate M challenge without retaining reviewer wording.
 *
 * @returns Exact privacy-safe guard category
 *
 * @example
 * ```ts
 * const diagnosis = diagnoseRiskChallenge({ value, role, candidate, reviewPlan, sourceReviewPlanDigest, pictureCount: 1, });
 * ```
 */
export function diagnoseRiskChallenge({
  value,
  role,
  candidate,
  reviewPlan,
  sourceReviewPlanDigest,
  pictureCount,
}: {
  readonly value: unknown;
  readonly role: CandidateMChallengerRole;
  readonly candidate: CandidateMCandidate;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceReviewPlanDigest: string;
  readonly pictureCount: number;
}): CandidateMChallengeDiagnosis {
  if ((!isJsonRecord(value,))
    || (JSON.stringify(Object.keys(value,)
      .toSorted(),) !== JSON.stringify([
      'candidateDigest',
      'candidateId',
      'deterministicProofDigest',
      'findings',
      'role',
      'sourceReviewPlanDigest',
      'verdict',
    ],)))
    return {
      kind: 'rejected',
      failure: 'key-set',
    };
  if ((value.candidateId !== candidate.candidateId)
    || (value.candidateDigest !== candidate.candidateDigest)
    || (value.deterministicProofDigest !== candidate.deterministicProofDigest)
    || (value.sourceReviewPlanDigest !== sourceReviewPlanDigest))
    return {
      kind: 'rejected',
      failure: 'candidate-binding',
    };
  if (value.role !== role)
    return {
      kind: 'rejected',
      failure: 'role',
    };
  if (((value.verdict !== 'clean') && (value.verdict !== 'defect'))
    || (!Array.isArray(value.findings,))
    || ((value.verdict === 'clean') && (value.findings
      .length
      > 0))
    || ((value.verdict === 'defect') && (value.findings
      .length
      !== 1)))
    return {
      kind: 'rejected',
      failure: 'verdict-finding-cardinality',
    };
  if (value.verdict === 'defect')
    return diagnoseRiskFinding({
      finding: value.findings[0],
      role,
      candidate,
      reviewPlan,
      pictureCount,
    });
  return { kind: 'accepted', };
}

/**
 * Captures exact Candidate M challenge guard.
 *
 * @returns Candidate and role-bound type guard
 *
 * @example
 * ```ts
 * const valid = riskChallengeGuard({ role, candidate, reviewPlan, sourceReviewPlanDigest, pictureCount: 1, })(value);
 * ```
 */
export function riskChallengeGuard({
  role,
  candidate,
  reviewPlan,
  sourceReviewPlanDigest,
  pictureCount,
}: {
  readonly role: CandidateMChallengerRole;
  readonly candidate: CandidateMCandidate;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceReviewPlanDigest: string;
  readonly pictureCount: number;
}): (value: unknown) => value is CandidateMChallengeResponse {
  return function valid(value: unknown): value is CandidateMChallengeResponse {
    /**
     * Exact diagnosis under captured candidate and role authority.
     */
    const diagnosis = diagnoseRiskChallenge({
      value,
      role,
      candidate,
      reviewPlan,
      sourceReviewPlanDigest,
      pictureCount,
    });
    return diagnosis.kind === 'accepted';
  };
}
