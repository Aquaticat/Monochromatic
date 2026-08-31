// PROTOTYPE ONLY: Candidate H private bounded-verdict selection.

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

/** Logger root for private Candidate H ballot abstention. */
const l = tagged({ tag: 'translation-repair-bounded-verdict', },);

/** Finds exact candidate row inside complete admitted ballot. */
function verificationFor({
  ballot,
  candidateId,
}: {
  readonly ballot: BoundedVerifierBallot;
  readonly candidateId: string;
}): BoundedCandidateVerification {
  const verification = ballot.response.candidates.find(function candidate(row,) {
    return row.candidateId === candidateId;
  },);
  if (verification === undefined)
    throw new Error(`bounded ballot candidate ${candidateId} is absent`);
  return verification;
}

/** Whether complete compact row explicitly certifies clean candidate. */
function isClean({ verification, }: {
  readonly verification: BoundedCandidateVerification;
}): boolean {
  return !verification.overflow
    && (verification.findings.length === 0)
    && verification.obligationStatuses.every(function preserved(code,) {
      return code === 'p';
    },)
    && verification.globalStatuses.every(function clean(code,) {
      return code === 'c';
    },);
}

/** Revalidates ballot before allowing any candidate row to vote. */
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
    l.debug(`bounded verdict ballot abstains after revalidation: ${String(error,)}`,);
    return false;
  }
}

/** Selects fixed-priority private fallback or independently clean candidate. */
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
  const priority = candidates.toSorted(function ordered(left, right,) {
    return (left.priority - right.priority)
      || left.candidateId.localeCompare(right.candidateId,);
  },);
  const fallback = priority[0];
  if (fallback === undefined)
    throw new Error('bounded verdict private fallback is absent');
  const plannedIdentities = [...new Set(manifest.verifierModelIds,),].toSorted();
  const plannedBallots = ballots.filter(function planned(ballot,) {
    return plannedIdentities.includes(ballot.verifierModelId,);
  },);
  const duplicated = plannedIdentities.filter(function duplicated(modelId,) {
    return plannedBallots.filter(function same(ballot,) {
      return ballot.verifierModelId === modelId;
    },).length > 1;
  },);
  duplicated.forEach(function report(modelId,) {
    l.debug(`bounded verdict ballot abstains after duplicate identity: ${modelId}`,);
  },);
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
  const validIdentities = validBallots.map(function identity(ballot,) {
    return ballot.verifierModelId;
  },).toSorted();
  const cleanByCandidate = new Map(priority.map(function candidateRow(candidate,) {
    const cleanIds = validBallots.filter(function clean(ballot,) {
      return isClean({
        verification: verificationFor({
          ballot,
          candidateId: candidate.candidateId,
        }),
      },);
    },).map(function identity(ballot,) {
      return ballot.verifierModelId;
    },).toSorted();
    return [candidate.candidateId, cleanIds,] as const;
  },),);
  const requiredCleanVerifierCount = 2;
  const authorDiversityMet = new Set(candidates.map(function family(candidate,) {
    return boundedModelFamily({ modelId: candidate.modelId, });
  },)).size >= 2;
  const selected = priority.find(function floor(candidate,) {
    const cleanIds = cleanByCandidate.get(candidate.candidateId,) ?? [];
    const cleanFamilies = new Set(cleanIds.map(function family(modelId,) {
      return boundedModelFamily({ modelId, });
    },));
    return authorDiversityMet
      && (cleanIds.length >= requiredCleanVerifierCount)
      && (cleanFamilies.size >= requiredCleanVerifierCount);
  },) ?? fallback;
  const cleanVerifierModelIds = cleanByCandidate.get(selected.candidateId,) ?? [];
  const cleanSet = new Set(cleanVerifierModelIds,);
  const dissentingVerifierModelIds = validIdentities.filter(function dissent(modelId,) {
    return !cleanSet.has(modelId,);
  },);
  const cleanVerifierFamilies = new Set(cleanVerifierModelIds.map(
    function family(modelId,) {
      return boundedModelFamily({ modelId, });
    },
  ));
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
      return !validIdentities.includes(modelId,);
    },),
  };
}
