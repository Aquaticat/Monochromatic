// PROTOTYPE ONLY: Candidate G immutable finite manifest identity.

import { hashContent, } from './document-node.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { assertRealizationLedgerBindsShell, } from './prototype-realization-ledger-validation.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_VERIFIERS,
  type RealizationCandidatePlan,
  type RealizationManifest,
  type RealizationObligationLedger,
  type RealizedCandidate,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/** Canonical digest of full immutable obligation ledger. */
export function realizationLedgerDigest({ ledger, }: { readonly ledger: RealizationObligationLedger; }): string {
  return hashContent({ content: JSON.stringify(ledger,), });
}

/** Canonical digest input excluding self-referential manifest digest. */
function manifestIdentity(value: Omit<RealizationManifest, 'manifestDigest'>,): string {
  return hashContent({ content: JSON.stringify(value,), });
}

/** Creates finite manifest after shell, ledger, author, and verifier authorization. */
export function createRealizationManifest({
  ledger,
  shell,
  archiveBody,
  candidatePlan,
  verifierModelIds,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly archiveBody: string;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierModelIds: RealizationManifest['verifierModelIds'];
}): RealizationManifest {
  assertRealizationLedgerBindsShell({ ledger, shell, archiveBody, });
  if ((candidatePlan.length === 0) || (candidatePlan.length > MAX_REALIZATION_CANDIDATES))
    throw new Error('realization manifest candidate count is outside finite bound');
  if ((verifierModelIds.length === 0) || (verifierModelIds.length > MAX_REALIZATION_VERIFIERS))
    throw new Error('realization manifest verifier count is outside finite bound');
  const ordinals = candidatePlan.map(function ordinal(plan,) { return plan.ordinal; },);
  const authorModels = candidatePlan.map(function model(plan,) { return plan.modelId; },);
  const priorities = candidatePlan.map(function priority(plan,) { return plan.priority; },);
  if ((new Set(ordinals,).size !== ordinals.length)
    || (new Set(authorModels,).size !== authorModels.length)
    || (new Set(priorities,).size !== priorities.length)
    || (new Set(verifierModelIds,).size !== verifierModelIds.length)
    || ordinals.some(function invalid(value,) { return !Number.isInteger(value,) || (value < 0); })
    || priorities.some(function invalid(value,) { return !Number.isInteger(value,) || (value < 0); }))
    throw new Error('realization manifest identity or priority repeats or is invalid');
  const orderedPlan = candidatePlan.toSorted(function ordinal(left, right,) { return left.ordinal - right.ordinal; },);
  if (orderedPlan.some(function nonContiguous(plan, index,) { return plan.ordinal !== index; }))
    throw new Error('realization manifest candidate ordinals are not contiguous');
  const orderedVerifierModelIds = [...verifierModelIds,].toSorted();
  const identity = {
    version: 1,
    shellDigest: shell.shellDigest,
    ledgerDigest: realizationLedgerDigest({ ledger, }),
    candidatePlan: orderedPlan,
    verifierModelIds: orderedVerifierModelIds,
    payloadCeiling: orderedPlan.length + verifierModelIds.length,
    dependencyWaves: 2,
  } as const;
  return { ...identity, manifestDigest: manifestIdentity(identity,), };
}

/** Refuses partial, extra, or unauthorized runtime candidate set. */
export function assertRealizationCandidateSetMatchesManifest({ candidates, manifest, }: {
  readonly candidates: readonly RealizedCandidate[];
  readonly manifest: RealizationManifest;
}): void {
  if (candidates.length !== manifest.candidatePlan.length)
    throw new Error('realization candidate set length differs from manifest');
  for (const plan of manifest.candidatePlan) {
    const candidateId = realizationCandidateAlias({
      manifestDigest: manifest.manifestDigest,
      ordinal: plan.ordinal,
    },);
    const candidate = candidates.find(function matching(value,) { return value.candidateId === candidateId; },);
    if ((candidate === undefined)
      || (candidate.manifestDigest !== manifest.manifestDigest)
      || (candidate.candidateOrdinal !== plan.ordinal)
      || (candidate.modelId !== plan.modelId)
      || (candidate.priority !== plan.priority))
      throw new Error('realization candidate set authorization differs from manifest');
  }
}

/** Refuses manifest, ledger, shell, roster, or digest substitution. */
export function assertRealizationManifest({
  manifest,
  ledger,
  shell,
  archiveBody,
  expectedManifestDigest,
}: {
  readonly manifest: RealizationManifest;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly archiveBody: string;
  readonly expectedManifestDigest: string;
}): void {
  const expected = createRealizationManifest({
    ledger,
    shell,
    archiveBody,
    candidatePlan: manifest.candidatePlan,
    verifierModelIds: manifest.verifierModelIds,
  },);
  if ((manifest.manifestDigest !== expectedManifestDigest)
    || (JSON.stringify(manifest,) !== JSON.stringify(expected,)))
    throw new Error('realization manifest identity differs');
}
