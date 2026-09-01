// PROTOTYPE ONLY: Candidate M strict two-role family selection.

import { boundedModelFamily, } from './prototype-bounded-verdict-family.ts';
import type {
  CandidateMManifest,
  CandidateMSelection
} from './prototype-risk-challenger-manifest-model.ts';
import {
  CANDIDATE_M_CHALLENGER_ROLES,
  type CandidateMChallenge,
  type CandidateMChallengeState,
  type CandidateMChallengerRole,
  type CandidateMCandidate,
} from './prototype-risk-challenger-model.ts';

/**
 * Admitted challenges from terminal dispatched states.
 *
 * @param states - Dispatched terminal challenge states
 *
 * @returns Atomic challenges in runtime state order
 */
function admittedChallenges(
  states: readonly CandidateMChallengeState[],
): readonly CandidateMChallenge[] {
  return states.flatMap(function challenge(state,) {
    return state.challenge === undefined ? [] : [state.challenge,];
  },);
}

/**
 * Fixed-priority candidate order independent of response arrival.
 *
 * @param candidates - Complete admitted author candidates
 *
 * @returns Minimum priority then minimum ordinal
 */
function orderedCandidates(
  candidates: readonly CandidateMCandidate[],
): readonly CandidateMCandidate[] {
  return candidates.toSorted(function priority(
    left,
    right,
  ) {
    return (left.priority - right.priority)
      || (left.candidateOrdinal - right.candidateOrdinal);
  },);
}

/**
 * Classifies one candidate under both strict role floors.
 *
 * @returns Candidate-specific private selection evidence
 */
function classifyCandidate({
  candidate,
  states,
  manifest,
}: {
  readonly candidate: CandidateMCandidate;
  readonly states: readonly CandidateMChallengeState[];
  readonly manifest: CandidateMManifest;
}): CandidateMSelection {
  /**
   * Candidate-bound admitted challenge subset.
   */
  const challenges = admittedChallenges(states,)
    .filter(function candidateChallenge(challenge,) {
    return (challenge.candidateId === candidate.candidateId)
      && (challenge.candidateDigest === candidate.candidateDigest)
      && (challenge.deterministicProofDigest === candidate.deterministicProofDigest);
  },);
  /**
   * Conservative self-model family excluded from clean floor.
   */
  const authorFamily = boundedModelFamily({ modelId: candidate.modelId, });
  /**
   * Clean nonself families under one whole-page role.
   *
   * @param role - Fixed whole-page responsibility
   *
   * @returns Unique conservative families
   */
  function cleanFamilies(role: CandidateMChallengerRole,): readonly string[] {
    /**
     * Clean candidate-bound challenge family list before uniqueness.
     */
    const families = challenges
      .filter(function clean(challenge,) {
      return (challenge.role === role)
        && (challenge.verdict === 'clean')
        && (boundedModelFamily({ modelId: challenge.verifierModelId, }) !== authorFamily);
    },)
      .map(function family(challenge,) {
      return boundedModelFamily({ modelId: challenge.verifierModelId, });
    });
    return [...new Set(families,),].toSorted();
  }
  /**
   * Strict clean family evidence separated by role.
   */
  const cleanFamiliesByRole = {
    fidelity: cleanFamilies('fidelity',),
    'publication-language': cleanFamilies('publication-language',),
  };
  /**
   * Every admitted defect model, including self model.
   */
  const dissentingVerifierModelIds = [...new Set(challenges
    .filter(function defect(challenge,) { return challenge.verdict === 'defect'; })
    .map(function model(challenge,) { return challenge.verifierModelId; }),),]
    .toSorted();
  /**
   * Admitted model-ordinal and role keys.
   */
  const admittedKeys = new Set(challenges.map(function key(challenge,) {
    return `${String(challenge.verifierOrdinal,)}:${challenge.role}`;
  },),);
  /**
   * Models with at least one missing or invalid role challenge.
   */
  const abstainingVerifierModelIds = [...new Set(manifest.verifierPlan
    .flatMap(function verifier(verifierPlan,) {
    return manifest.challengerRoles
      .flatMap(function role(roleName,) {
      return admittedKeys.has(`${String(verifierPlan.ordinal,)}:${roleName}`)
        ? []
        : [verifierPlan.modelId,];
    },);
  },),)].toSorted();
  /**
   * Whether both roles have exactly both available nonself families.
   */
  const evidenceFloorMet = CANDIDATE_M_CHALLENGER_ROLES.every(function floor(role,) {
    return cleanFamiliesByRole[role]
      .length
      === 2;
  },);
  return {
    candidate,
    evidenceFloorMet,
    productionEligible: evidenceFloorMet && (dissentingVerifierModelIds.length === 0),
    cleanFamiliesByRole,
    dissentingVerifierModelIds,
    abstainingVerifierModelIds,
  };
}

/**
 * Selects eligible Candidate M candidate or explicit ineligible private fallback.
 *
 * @returns Deterministic private selection
 *
 * @example
 * ```ts
 * const selection = selectCandidateM({ candidates, states, manifest, });
 * ```
 */
export function selectCandidateM({
  candidates,
  states,
  manifest,
}: {
  readonly candidates: readonly CandidateMCandidate[];
  readonly states: readonly CandidateMChallengeState[];
  readonly manifest: CandidateMManifest;
}): CandidateMSelection {
  if (candidates.length === 0)
    throw new Error('Candidate M private selection has no candidate');
  /**
   * Candidate classifications in deterministic fallback order.
   */
  const classified = orderedCandidates(candidates,)
    .map(function classify(candidate,) {
    return classifyCandidate({
      candidate,
      states,
      manifest,
    });
  },);
  /**
   * First production-eligible candidate in fallback order.
   */
  const eligible = classified.find(function production(value,) {
    return value.productionEligible;
  },);
  if (eligible !== undefined)
    return eligible;
  /**
   * First complete private fallback after candidate nonempty proof.
   */
  const [fallback,] = classified;
  if (fallback === undefined)
    throw new Error('Candidate M deterministic selection is absent');
  return fallback;
}
