// PROTOTYPE ONLY: Candidate G private calibration selection.

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  candidatesFromRealizationAuthorSettlement,
  type RealizationAuthorSettlement,
} from './prototype-realization-author-settlement.ts';
import { assertRealizationManifest, } from './prototype-realization-manifest.ts';
import { assertRealizedCandidateBinding, } from './prototype-realization-candidate-binding.ts';
import { admitRealizationVerifierResponse, } from './prototype-realization-verifier-admission.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_VERIFIERS,
  type RealizationCandidateVerification,
  type RealizationManifest,
  type RealizationObligationLedger,
  type RealizationSelection,
  type RealizationVerifierBallot,
  type RealizedCandidate,
} from './prototype-realization-model.ts';

/**
 * Logger root for private calibration ballot abstention.
 */
const l = tagged({ tag: 'translation-repair-realization', },);

/**
 * Revalidates structurally typed ballot before it can vote.
 */
function ballotIsAdmitted({
  ballot,
  ledger,
  authorSettlement,
  shell,
  manifest,
  expectedManifestDigest,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly ballot: RealizationVerifierBallot;
  readonly ledger: RealizationObligationLedger;
  readonly authorSettlement: RealizationAuthorSettlement;
  readonly shell: ImmutableShell;
  readonly manifest: RealizationManifest;
  readonly expectedManifestDigest: string;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): boolean {
  try {
    admitRealizationVerifierResponse({
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
    l.debug(`realization ballot abstains after revalidation: ${String(error,)}`,);
    return false;
  }
}

/**
 * Finds admitted candidate verification inside one ballot.
 */
function verificationFor({
  ballot,
  candidateId,
}: {
  readonly ballot: RealizationVerifierBallot;
  readonly candidateId: string;
}): RealizationCandidateVerification {
  const verification = ballot.response
    .candidates
    .find(function candidate(value,) {
    return value.candidateId === candidateId;
  },);
  if (verification === undefined)
    throw new Error(`realization ballot candidate ${candidateId} is absent`);
  return verification;
}

/**
 * Decides whether one complete matrix explicitly marks candidate clean.
 */
function verificationIsClean({ verification, }: {
  readonly verification: RealizationCandidateVerification;
}): boolean {
  return verification.obligations
    .every(function preserved(status,) { return status.status === 'preserved'; },)
    && verification.globalChecks
    .every(function clean(status,) { return status.status === 'clean'; },)
    && (verification.findings
      .length
      === 0);
}

/**
 * Selects private review candidate without claiming cross-family independence.
 */
export function selectRealizationCandidate({
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
  readonly authorSettlement: RealizationAuthorSettlement;
  readonly ballots: readonly RealizationVerifierBallot[];
  readonly manifest: RealizationManifest;
  readonly expectedManifestDigest: string;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): RealizationSelection {
  assertRealizationManifest({
    manifest,
    ledger,
    shell,
    archiveBody: archiveText,
    expectedManifestDigest,
  },);
  const candidates = candidatesFromRealizationAuthorSettlement({ settlement: authorSettlement, manifest, });
  const {
    manifestDigest,
    verifierModelIds: plannedVerifierModelIds,
  } = manifest;
  if ((candidates.length === 0) || (candidates.length > MAX_REALIZATION_CANDIDATES))
    throw new Error('realization selection candidate count is outside finite bound');
  const candidateIds = candidates.map(function id(candidate,) { return candidate.candidateId; },);
  const aliasesAreOpaque = candidateIds.every(function opaque(candidateId,) {
    const prefix = 'candidate-';
    const suffix = candidateId.slice(prefix.length,);
    const characters = Array.from(
      { length: suffix.length, },
      function characterAt(
        _value,
        index,
      ) {
      return suffix.charAt(index,);
    },
    );
    return candidateId.startsWith(prefix,)
      && (suffix.length === 16)
      && characters.every(function hexadecimal(character,) {
        return ((character >= '0') && (character <= '9'))
          || ((character >= 'a') && (character <= 'f'));
      },);
  },);
  if ((new Set(candidateIds,).size !== candidateIds.length) || (!aliasesAreOpaque))
    throw new Error('realization selection candidate alias differs');
  for (const candidate of candidates) {
    assertRealizedCandidateBinding({
      candidate,
      ledger,
      shell,
      manifestDigest,
      sourceText,
      archiveText,
      sourcePictures,
    },);
  }
  if ((plannedVerifierModelIds.length === 0)
    || (plannedVerifierModelIds.length > MAX_REALIZATION_VERIFIERS)
    || (new Set(plannedVerifierModelIds,).size !== plannedVerifierModelIds.length))
    throw new Error('realization selection verifier plan differs');
  if (ballots.length > MAX_REALIZATION_VERIFIERS)
    throw new Error('realization selection ballot count exceeds finite bound');
  const priority = candidates.toSorted(function ordered(
    left,
    right,
  ) {
    return (left.priority - right.priority)
      || left.candidateId
      .localeCompare(right.candidateId,);
  },);
  const fallback = priority[0];
  if (fallback === undefined)
    throw new Error('realization candidate set is empty');
  const plannedIdentities = [...new Set(plannedVerifierModelIds,),].toSorted();
  const plannedBallots = ballots.filter(function planned(ballot,) {
    return plannedIdentities.includes(ballot.verifierModelId,);
  },);
  const duplicateIdentities = plannedIdentities.filter(function duplicated(modelId,) {
    return plannedBallots.filter(function sameIdentity(ballot,) {
      return ballot.verifierModelId === modelId;
    },)
      .length
      > 1;
  },);
  duplicateIdentities.forEach(function logDuplicate(modelId,) {
    l.debug(`realization ballot abstains after duplicate verifier identity: ${modelId}`,);
  },);
  plannedBallots.filter(function stale(ballot,) {
    return ballot.manifestDigest !== manifestDigest;
  },)
    .forEach(function logStale(ballot,) {
    l.debug(`realization ballot abstains after stale manifest: ${ballot.verifierModelId}`,);
  },);
  const validBallots = plannedBallots
    .filter(function uniqueIdentity(ballot,) { return !duplicateIdentities.includes(ballot.verifierModelId,); })
    .filter(function currentManifest(ballot,) {
      return (ballot.manifestDigest === manifestDigest)
        && ballotIsAdmitted({
          ballot,
          ledger,
          authorSettlement,
          shell,
          manifest,
          expectedManifestDigest,
          sourceText,
          archiveText,
          sourcePictures,
        },);
    },);
  const validIdentities = [...new Set(validBallots.map(function identity(ballot,) {
    return ballot.verifierModelId;
  },),),].toSorted();
  const cleanByCandidate = new Map(priority.map(function candidateRow(candidate,) {
    const identities = validBallots
      .filter(function clean(ballot,) {
        return verificationIsClean({ verification: verificationFor({
          ballot,
          candidateId: candidate.candidateId,
        }), });
      },)
      .map(function identity(ballot,) { return ballot.verifierModelId; });
    return [
      candidate.candidateId,
      [...new Set(identities,),].toSorted(),
    ] as const;
  },),);
  const requiredCleanVerifierCount = 2;
  const authorDiversityMet = new Set(candidates.map(function identity(candidate,) {
    return candidate.modelId;
  },),).size >= 2;
  const selected = priority.find(function floor(candidate,) {
    return authorDiversityMet
      && ((cleanByCandidate.get(candidate.candidateId,)
        ?.length
        ?? 0) >= requiredCleanVerifierCount);
  },) ?? fallback;
  const cleanVerifierModelIds = cleanByCandidate.get(selected.candidateId,) ?? [];
  const cleanSet = new Set(cleanVerifierModelIds,);
  return {
    candidate: selected,
    cleanVerifierModelIds,
    evidenceFloorMet: authorDiversityMet && (cleanVerifierModelIds.length >= requiredCleanVerifierCount),
    independenceScope: 'distinct-author-and-verifier-model-identities-only',
    dissentingVerifierModelIds: validIdentities.filter(function dissent(modelId,) { return !cleanSet.has(modelId,); }),
    abstainingVerifierModelIds: plannedIdentities.filter(function abstained(modelId,) {
      return !validIdentities.includes(modelId,);
    },),
  };
}
