// PROTOTYPE ONLY: Candidate H private bounded-verdict selection.

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { admitBoundedVerifierResponse, } from './prototype-bounded-verdict-admission.ts';
import { assertBoundedCandidateBinding, } from './prototype-bounded-verdict-author.ts';
import { boundedModelFamily, } from './prototype-bounded-verdict-family.ts';
import { assertBoundedVerdictManifest, } from './prototype-bounded-verdict-manifest.ts';
import type {
  BoundedAuthorSettlement,
  BoundedCandidateVerification,
  BoundedSelection,
  BoundedVerifierBallot,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import { candidatesFromBoundedSettlement, } from './prototype-bounded-verdict-settlement.ts';
import {
  MAX_REALIZATION_VERIFIERS,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Logger root for private Candidate H ballot abstention.
 */
const l = tagged({ tag: 'translation-repair-bounded-verdict', },);

/**
 * Finds exact candidate row inside complete admitted ballot.
 *
 * @returns Candidate row required by atomic ballot contract
 */
function verificationFor({
  ballot,
  candidateId,
}: {
  readonly ballot: BoundedVerifierBallot;
  readonly candidateId: string;
}): BoundedCandidateVerification {
  /**
   * Verification row selected by anonymous candidate alias.
   */
  const verification = ballot.response
    .candidates
    .find(function candidate(row,) {
    return row.candidateId === candidateId;
  },);
  if (verification === undefined)
    throw new Error(`bounded ballot candidate ${candidateId} is absent`);
  return verification;
}

/**
 * Whether complete compact row explicitly certifies clean candidate.
 *
 * @returns Whether every status is clean and no finding or overflow remains
 */
function isClean({ verification, }: {
  readonly verification: BoundedCandidateVerification;
}): boolean {
  return (!verification.overflow)
    && (verification.findings
      .length
      === 0)
    && verification.obligationStatuses
    .every(function preserved(code,) {
      return code === 'p';
    },)
    && verification.globalStatuses
    .every(function clean(code,) {
      return code === 'c';
    },);
}

/**
 * Revalidates ballot before allowing any candidate row to vote.
 *
 * @returns Whether complete ballot remains admitted at selection boundary
 */
function ballotIsAdmitted({
  ballot,
  ledger,
  authorSettlement,
  manifest,
  expectedManifestDigest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly ballot: BoundedVerifierBallot;
  readonly ledger: RealizationObligationLedger;
  readonly authorSettlement: BoundedAuthorSettlement;
  readonly manifest: BoundedVerdictManifest;
  readonly expectedManifestDigest: string;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): boolean {
  try {
    admitBoundedVerifierResponse({
      response: ballot.response,
      ledger,
      authorSettlement,
      verifierModelId: ballot.verifierModelId,
      manifest,
      expectedManifestDigest,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
    return true;
  }
  catch (error) {
    l.debug(`bounded verdict ballot abstains after revalidation: ${caughtValueText(error,)}`,);
    return false;
  }
}

/**
 * Selects fixed-priority private fallback or independently clean candidate.
 *
 * @returns Private selection with evidence, dissent, and abstention classification
 *
 * @example
 * ```ts
 * const selection = selectBoundedCandidate({
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
export function selectBoundedCandidate({
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
  readonly authorSettlement: BoundedAuthorSettlement;
  readonly ballots: readonly BoundedVerifierBallot[];
  readonly manifest: BoundedVerdictManifest;
  readonly expectedManifestDigest: string;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): BoundedSelection {
  assertBoundedVerdictManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  /**
   * Complete admitted candidates derived from total author settlement.
   */
  const candidates = candidatesFromBoundedSettlement({
    settlement: authorSettlement,
    manifest,
  },);
  if (candidates.length === 0)
    throw new Error('bounded verdict selection candidate set is empty');
  for (const candidate of candidates) {
    assertBoundedCandidateBinding({
      candidate,
      manifest,
      shell,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  }
  if (ballots.length > MAX_REALIZATION_VERIFIERS)
    throw new Error('bounded verdict ballot count exceeds finite bound');
  /**
   * Candidates ordered by hidden manifest priority and stable alias tie-break.
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
   * Fixed private fallback when evidence floor is not met.
   */
  const [fallback,] = priority;
  if (fallback === undefined)
    throw new Error('bounded verdict private fallback is absent');
  /**
   * Unique verifier identities authorized by manifest.
   */
  const plannedIdentities = [...new Set(manifest.verifierModelIds,),].toSorted();
  /**
   * Supplied ballots whose identities occur in manifest.
   */
  const plannedBallots = ballots.filter(function planned(ballot,) {
    return plannedIdentities.includes(ballot.verifierModelId,);
  },);
  /**
   * Verifier identities repeated in supplied ballot set.
   */
  const duplicated = plannedIdentities.filter(function duplicated(modelId,) {
    return plannedBallots.filter(function same(ballot,) {
      return ballot.verifierModelId === modelId;
    },)
      .length
      > 1;
  },);
  duplicated.forEach(function report(modelId,) {
    l.debug(`bounded verdict ballot abstains after duplicate identity: ${modelId}`,);
  },);
  /**
   * Unique current ballots passing whole-response revalidation.
   */
  const validBallots = plannedBallots
    .filter(function unique(ballot,) {
      return !duplicated.includes(ballot.verifierModelId,);
    },)
    .filter(function current(ballot,) {
      return (ballot.manifestDigest === manifest.manifestDigest)
        && ballotIsAdmitted({
          ballot,
          ledger,
          authorSettlement,
          manifest,
          expectedManifestDigest,
          shell,
          sourceText,
          archiveText,
          sourcePictures,
        },);
    },);
  /**
   * Admitted verifier identities in stable order.
   */
  const validIdentities = new Set(validBallots.map(function identity(ballot,) {
    return ballot.verifierModelId;
  },)
    .toSorted());
  /**
   * Clean verifier identities indexed by anonymous candidate alias.
   */
  const cleanByCandidate = new Map(priority.map(function candidateRow(candidate,) {
    /**
     * Verifier identities explicitly certifying this candidate clean.
     */
    const cleanIds = validBallots.filter(function clean(ballot,) {
      return (ballot.verifierModelId !== candidate.modelId)
        && isClean({
        verification: verificationFor({
          ballot,
          candidateId: candidate.candidateId,
        }),
      },);
    },)
      .map(function identity(ballot,) {
      return ballot.verifierModelId;
    },)
      .toSorted();
    return [
      candidate.candidateId,
      cleanIds,
    ] as const;
  },),);
  /**
   * Required verifier identity and family count for evidence floor.
   */
  const requiredCleanVerifierCount = 2;
  /**
   * Whether admitted author candidates span required model families.
   */
  const authorDiversityMet = new Set(candidates.map(function family(candidate,) {
    return boundedModelFamily({ modelId: candidate.modelId, });
  },)).size >= 2;
  /**
   * First hidden-priority candidate reaching family-aware clean floor.
   */
  const selected = priority.find(function floor(candidate,) {
    /**
     * Clean verifier identities for current candidate.
     */
    const cleanIds = cleanByCandidate.get(candidate.candidateId,) ?? [];
    /**
     * Conservative clean verifier families for current candidate.
     */
    const cleanFamilies = new Set(cleanIds.map(function family(modelId,) {
      return boundedModelFamily({ modelId, });
    },));
    return authorDiversityMet
      && (cleanIds.length >= requiredCleanVerifierCount)
      && (cleanFamilies.size >= requiredCleanVerifierCount);
  },) ?? fallback;
  /**
   * Clean verifier identities for selected candidate.
   */
  const cleanVerifierModelIds = cleanByCandidate.get(selected.candidateId,) ?? [];
  /**
   * Admitted verifier identities explicitly finding selected candidate unclean.
   */
  const dissentingVerifierModelIds = validBallots.filter(function dissent(ballot,) {
    return !isClean({
      verification: verificationFor({
        ballot,
        candidateId: selected.candidateId,
      }),
    },);
  },)
    .map(function identity(ballot,) {
    return ballot.verifierModelId;
  },)
    .toSorted();
  /**
   * Conservative model families represented by clean verifier identities.
   */
  const cleanVerifierFamilies = new Set(cleanVerifierModelIds.map(
    function family(modelId,) {
      return boundedModelFamily({ modelId, });
    },
  ));
  /**
   * Whether selected candidate reaches author and verifier family floors.
   */
  const evidenceFloorMet = authorDiversityMet
    && (cleanVerifierModelIds.length >= requiredCleanVerifierCount)
    && (cleanVerifierFamilies.size >= requiredCleanVerifierCount);
  return {
    candidate: selected,
    cleanVerifierModelIds,
    evidenceFloorMet,
    productionEligible: evidenceFloorMet
      && (dissentingVerifierModelIds.length === 0),
    independenceScope: 'distinct-author-and-verifier-model-families',
    dissentingVerifierModelIds,
    abstainingVerifierModelIds: plannedIdentities.filter(function abstained(modelId,) {
      return !validIdentities.has(modelId,);
    },),
  };
}
