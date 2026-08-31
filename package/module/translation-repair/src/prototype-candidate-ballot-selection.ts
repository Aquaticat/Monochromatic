// PROTOTYPE ONLY: Candidate I private candidate-scoped selection.

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { admitCandidateBallotResponse, } from './prototype-candidate-ballot-admission.ts';
import { assertCandidateBallotBinding, } from './prototype-candidate-ballot-author.ts';
import { boundedModelFamily, } from './prototype-bounded-verdict-family.ts';
import { assertCandidateBallotManifest, } from './prototype-candidate-ballot-manifest.ts';
import {
  CANDIDATE_BALLOT_VERIFIER_COUNT,
  type CandidateBallotAuthorSettlement,
  type CandidateBallotResponse,
  type CandidateBallotSelection,
  type CandidateBallotManifest,
  type CandidateScopedBallot,
} from './prototype-candidate-ballot-model.ts';
import { candidatesFromCandidateBallotSettlement, } from './prototype-candidate-ballot-settlement.ts';
import type { RealizationObligationLedger, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Logger root for privacy-safe ballot abstention.
 */
const l = tagged({ tag: 'translation-repair-candidate-ballot', },);

/**
 * Whether complete compact response explicitly certifies candidate clean.
 *
 * @returns Whether every status is clean with no finding or overflow
 */
function isClean({
  response,
}: {
  readonly response: CandidateBallotResponse;
}): boolean {
  return (!response.overflow)
    && (response.findings
      .length
      === 0)
    && (!response.obligationStatuses
      .includes('d',))
    && (!response.globalStatuses
      .includes('d',));
}

/**
 * Revalidates one scoped ballot before any vote.
 *
 * @returns Whether complete ballot remains admitted at selection boundary
 */
function ballotIsAdmitted({
  ballot,
  verifierOrdinal,
  ledger,
  authorSettlement,
  manifest,
  expectedManifestDigest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly ballot: CandidateScopedBallot;
  readonly verifierOrdinal: number;
  readonly ledger: RealizationObligationLedger;
  readonly authorSettlement: CandidateBallotAuthorSettlement;
  readonly manifest: CandidateBallotManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): boolean {
  try {
    /**
     * Runtime-owned ballot recomputed from persisted provider response.
     */
    const expected = admitCandidateBallotResponse({
      response: ballot.response,
      ledger,
      authorSettlement,
      candidateOrdinal: ballot.candidateOrdinal,
      verifierOrdinal,
      verifierModelId: ballot.verifierModelId,
      manifest,
      expectedManifestDigest,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
    return JSON.stringify(ballot,) === JSON.stringify(expected,);
  }
  catch (error) {
    l.debug(`candidate ballot abstains after revalidation: ${caughtValueText(error,)}`,);
    return false;
  }
}

/**
 * Selects fixed-priority fallback or independently clean candidate.
 *
 * @returns Private selection with evidence and abstention classification
 *
 * @example
 * ```ts
 * const selection = selectCandidateBallot({
 *   authorSettlement,
 *   ballots,
 *   manifest,
 *   expectedManifestDigest,
 *   ledger,
 *   shell,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 * });
 * ```
 */
export function selectCandidateBallot({
  authorSettlement,
  ballots,
  manifest,
  expectedManifestDigest,
  ledger,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly authorSettlement: CandidateBallotAuthorSettlement;
  readonly ballots: readonly CandidateScopedBallot[];
  readonly manifest: CandidateBallotManifest;
  readonly expectedManifestDigest: string;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): CandidateBallotSelection {
  assertCandidateBallotManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  /**
   * Complete candidates from total author settlement.
   */
  const candidates = candidatesFromCandidateBallotSettlement({
    settlement: authorSettlement,
    manifest,
  },);
  if (candidates.length === 0)
    throw new Error('candidate ballot selection candidate set is empty');
  candidates.forEach(function binding(candidate,) {
    assertCandidateBallotBinding({
      candidate,
      manifest,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  },);
  if (ballots.length > (candidates.length * CANDIDATE_BALLOT_VERIFIER_COUNT))
    throw new Error('candidate ballot count exceeds finite bound');
  /**
   * Candidates ordered by hidden priority and stable alias.
   */
  const priority = candidates.toSorted(function ordered(
    left,
    right,
  ) {
    return (left.priority - right.priority)
      || left.candidateId
      .localeCompare(right.candidateId,);
  },);
  /**
   * Fixed private fallback.
   */
  const [fallback,] = priority;
  if (fallback === undefined)
    throw new Error('candidate ballot private fallback is absent');
  /**
   * Valid unique ballots by candidate after exact revalidation.
   */
  const validByCandidate = new Map(priority.map(function candidateBallots(candidate,) {
    /**
     * Planned scoped ballots for current candidate.
     */
    const scoped = ballots.filter(function scopedBallot(ballot,) {
      return (ballot.candidateOrdinal === candidate.candidateOrdinal)
        && (ballot.manifestDigest === manifest.manifestDigest)
        && manifest.verifierPlan
        .some(function planned(plan,) {
          return plan.modelId === ballot.verifierModelId;
        },);
    },);
    /**
     * Repeated verifier identities for this candidate.
     */
    const duplicated = manifest.verifierPlan
      .flatMap(function duplicate(plan,) {
      return scoped.filter(function same(ballot,) {
        return ballot.verifierModelId === plan.modelId;
      },)
        .length
        > 1 ? [plan.modelId,] : [];
    },);
    duplicated.forEach(function report(modelId,) {
      l.debug(`candidate ballot abstains after duplicate identity: ${modelId}`,);
    },);
    /**
     * Unique current ballots passing semantic admission.
     */
    const valid = scoped.filter(function unique(ballot,) {
      return !duplicated.includes(ballot.verifierModelId,);
    },)
      .filter(function admitted(ballot,) {
      /**
       * Manifest verifier ordinal for identity.
       */
      const verifierOrdinal = manifest.verifierPlan
        .findIndex(function model(plan,) {
        return plan.modelId === ballot.verifierModelId;
      },);
      return ballotIsAdmitted({
        ballot,
        verifierOrdinal,
        ledger,
        authorSettlement,
        manifest,
        expectedManifestDigest,
        shell,
        sourceText,
        archiveText,
        sourcePictures,
      });
    },);
    return [
      candidate.candidateId,
      valid,
    ] as const;
  },),);
  /**
   * Required nonself clean identities and families.
   */
  const cleanByCandidate = new Map(priority.map(function cleanRow(candidate,) {
    /**
     * Nonself admitted identities certifying current candidate clean.
     */
    const cleanIds = (validByCandidate.get(candidate.candidateId,) ?? [])
      .filter(function clean(ballot,) {
        return (boundedModelFamily({ modelId: ballot.verifierModelId, })
          !== boundedModelFamily({ modelId: candidate.modelId, }))
          && isClean({ response: ballot.response, });
      },)
      .map(function identity(ballot,) { return ballot.verifierModelId; })
      .toSorted();
    return [
      candidate.candidateId,
      cleanIds,
    ] as const;
  },),);
  /**
   * First hidden-priority candidate reaching two-family nonself floor.
   */
  const selected = priority.find(function floor(candidate,) {
    /**
     * Nonself clean identities for current candidate.
     */
    const cleanIds = cleanByCandidate.get(candidate.candidateId,) ?? [];
    /**
     * Distinct conservative families represented by clean identities.
     */
    const families = new Set(cleanIds.map(function family(modelId,) {
      return boundedModelFamily({ modelId, });
    },));
    return (cleanIds.length >= 2) && (families.size >= 2);
  },) ?? fallback;
  /**
   * Admitted ballots for selected candidate.
   */
  const selectedBallots = validByCandidate.get(selected.candidateId,) ?? [];
  /**
   * Nonself clean identities for selected candidate.
   */
  const cleanVerifierModelIds = cleanByCandidate.get(selected.candidateId,) ?? [];
  /**
   * Every admitted self or nonself defect vetoes production.
   */
  const dissentingVerifierModelIds = selectedBallots.filter(function dissent(ballot,) {
    return !isClean({ response: ballot.response, });
  },)
    .map(function identity(ballot,) { return ballot.verifierModelId; })
    .toSorted();
  /**
   * Distinct clean nonself families.
   */
  const cleanFamilies = new Set(cleanVerifierModelIds.map(function family(modelId,) {
    return boundedModelFamily({ modelId, });
  },));
  /**
   * Evidence floor independent from no-dissent publication gate.
   */
  const evidenceFloorMet = (cleanVerifierModelIds.length >= 2)
    && (cleanFamilies.size >= 2);
  /**
   * Admitted selected-candidate verifier identities.
   */
  const admittedIds = new Set(selectedBallots.map(function identity(ballot,) {
    return ballot.verifierModelId;
  },));
  return {
    candidate: selected,
    cleanVerifierModelIds,
    evidenceFloorMet,
    productionEligible: evidenceFloorMet && (dissentingVerifierModelIds.length === 0),
    independenceScope: 'distinct-author-and-verifier-model-families',
    dissentingVerifierModelIds,
    abstainingVerifierModelIds: manifest.verifierPlan
      .flatMap(function abstained(plan,) {
      return admittedIds.has(plan.modelId,) ? [] : [plan.modelId,];
    },),
  };
}
