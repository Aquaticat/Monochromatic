// PROTOTYPE ONLY: Candidate H immutable finite manifest.

import { hashContent, } from './document-node.ts';
import { photoReferences, } from './photo-reference.ts';
import { boundedModelFamily, } from './prototype-bounded-verdict-family.ts';
import {
  BOUNDED_VERDICT_FINDING_CAP,
  MAX_BOUNDED_PAYLOAD_COUNT,
  type BoundedCandidate,
  type BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import {
  BOUNDED_AUTHOR_PROTOCOL_DIGEST,
  BOUNDED_VERIFIER_PROTOCOL_DIGEST,
} from './prototype-bounded-verdict-prompt.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { assertRealizationLedgerBindsShell, } from './prototype-realization-ledger-validation.ts';
import {
  MAX_REALIZATION_CANDIDATES,
  MAX_REALIZATION_VERIFIERS,
  type RealizationCandidatePlan,
  type RealizationObligationLedger,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import { slotResponseFormat, } from './prototype-slot-wire.ts';

/** Canonical digest of full closed-world obligation ledger. */
export function boundedLedgerDigest({ ledger, }: {
  readonly ledger: RealizationObligationLedger;
}): string {
  return hashContent({ content: JSON.stringify(ledger,), });
}

/** Canonical digest input excluding self reference. */
function manifestDigest(
  value: Omit<BoundedVerdictManifest, 'manifestDigest'>,
): string {
  return hashContent({ content: JSON.stringify(value,), });
}

/** Refuses duplicate or invalid author and verifier authorization. */
function assertRoster({
  candidatePlan,
  verifierModelIds,
}: {
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierModelIds: BoundedVerdictManifest['verifierModelIds'];
}): void {
  if ((candidatePlan.length !== MAX_REALIZATION_CANDIDATES)
    || (verifierModelIds.length !== MAX_REALIZATION_VERIFIERS)
    || ((candidatePlan.length + verifierModelIds.length)
      !== MAX_BOUNDED_PAYLOAD_COUNT))
    throw new Error('bounded verdict roster count differs from fixed graph');
  const ordered = candidatePlan.toSorted(function ordinal(left, right,) {
    return left.ordinal - right.ordinal;
  },);
  const ordinals = ordered.map(function ordinal(plan,) { return plan.ordinal; });
  const models = ordered.map(function model(plan,) { return plan.modelId; });
  const priorities = ordered.map(function priority(plan,) { return plan.priority; });
  const authorFamilies = new Set(ordered.map(function family(plan,) {
    return boundedModelFamily({ modelId: plan.modelId, });
  },));
  const verifierFamilies = new Set(verifierModelIds.map(function family(modelId,) {
    return boundedModelFamily({ modelId, });
  },));
  if ((new Set(ordinals,).size !== ordinals.length)
    || (new Set(models,).size !== models.length)
    || (new Set(priorities,).size !== priorities.length)
    || (new Set(verifierModelIds,).size !== verifierModelIds.length)
    || models.some(function selfReview(modelId,) {
      return verifierModelIds.includes(modelId,);
    },)
    || (authorFamilies.size < 2)
    || (verifierFamilies.size < 2)
    || ordered.some(function noncontiguous(plan, index,) {
      return plan.ordinal !== index;
    },)
    || priorities.some(function invalid(priority,) {
      return (!Number.isInteger(priority,)) || (priority < 0);
    },))
    throw new Error('bounded verdict roster identity or priority differs');
}

/** Refuses source image list not equal to page references. */
function assertPictures({
  shell,
  sourcePictures,
}: {
  readonly shell: ImmutableShell;
  readonly sourcePictures: BoundedVerdictManifest['sourcePictures'];
}): void {
  const names = sourcePictures.map(function name(picture,) {
    return picture.assetName;
  },);
  const referenced = [...new Set(photoReferences({ text: shell.body, })
    .map(function name(picture,) { return picture.assetName; }),),]
    .toSorted();
  if ((new Set(names,).size !== names.length)
    || (JSON.stringify(names.toSorted(),) !== JSON.stringify(referenced,))
    || sourcePictures.some(function malformed(picture,) {
      return (picture.assetName.length === 0) || (picture.digest.length !== 64);
    },))
    throw new Error('bounded verdict picture binding differs');
}

/** Creates Candidate H manifest with exactly two finite payload waves. */
export function createBoundedVerdictManifest({
  ledger,
  shell,
  archiveBody,
  candidatePlan,
  verifierModelIds,
  providerSelection,
  sourcePictures,
}: {
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly archiveBody: string;
  readonly candidatePlan: readonly RealizationCandidatePlan[];
  readonly verifierModelIds: BoundedVerdictManifest['verifierModelIds'];
  readonly providerSelection: BoundedVerdictManifest['providerSelection'];
  readonly sourcePictures: BoundedVerdictManifest['sourcePictures'];
}): BoundedVerdictManifest {
  assertRealizationLedgerBindsShell({ ledger, shell, archiveBody, });
  assertRoster({ candidatePlan, verifierModelIds, });
  assertPictures({ shell, sourcePictures, });
  if ((providerSelection !== 'all')
    && (providerSelection !== 'synthetic-only')
    && (providerSelection !== 'hyper-only'))
    throw new Error('bounded verdict provider selection differs');
  const orderedPlan = candidatePlan.toSorted(function ordinal(left, right,) {
    return left.ordinal - right.ordinal;
  },);
  const orderedVerifiers = [...verifierModelIds,].toSorted();
  const identity = {
    version: 2,
    shellDigest: shell.shellDigest,
    ledgerDigest: boundedLedgerDigest({ ledger, }),
    candidatePlan: orderedPlan,
    verifierModelIds: orderedVerifiers,
    providerSelection,
    authorProtocolDigest: BOUNDED_AUTHOR_PROTOCOL_DIGEST,
    authorSchemaDigest: hashContent({
      content: JSON.stringify(slotResponseFormat({ shell, }),),
    },),
    verifierProtocolDigest: BOUNDED_VERIFIER_PROTOCOL_DIGEST,
    findingCap: BOUNDED_VERDICT_FINDING_CAP,
    sourcePictures,
    payloadCountCeiling: orderedPlan.length + orderedVerifiers.length,
    dependencyWaves: 2,
  } as const;
  return {
    ...identity,
    manifestDigest: manifestDigest(identity,),
  };
}

/** Refuses manifest, shell, ledger, media, or roster substitution. */
export function assertBoundedVerdictManifest({
  manifest,
  ledger,
  shell,
  archiveBody,
  expectedManifestDigest,
}: {
  readonly manifest: BoundedVerdictManifest;
  readonly ledger: RealizationObligationLedger;
  readonly shell: ImmutableShell;
  readonly archiveBody: string;
  readonly expectedManifestDigest: string;
}): void {
  const expected = createBoundedVerdictManifest({
    ledger,
    shell,
    archiveBody,
    candidatePlan: manifest.candidatePlan,
    verifierModelIds: manifest.verifierModelIds,
    providerSelection: manifest.providerSelection,
    sourcePictures: manifest.sourcePictures,
  },);
  if ((manifest.manifestDigest !== expectedManifestDigest)
    || (JSON.stringify(manifest,) !== JSON.stringify(expected,)))
    throw new Error('bounded verdict manifest identity differs');
}

/** Refuses anonymous candidate set outside manifest authorization. */
export function assertBoundedCandidatesAuthorized({
  candidates,
  manifest,
}: {
  readonly candidates: readonly BoundedCandidate[];
  readonly manifest: BoundedVerdictManifest;
}): void {
  if ((candidates.length === 0)
    || (candidates.length > manifest.candidatePlan.length)
    || (new Set(candidates.map(function id(candidate,) {
      return candidate.candidateId;
    },)).size !== candidates.length))
    throw new Error('bounded verdict candidate set length or alias differs');
  for (const candidate of candidates) {
    const plan = manifest.candidatePlan.find(function authorized(value,) {
      return realizationCandidateAlias({
        manifestDigest: manifest.manifestDigest,
        ordinal: value.ordinal,
      },) === candidate.candidateId;
    },);
    if ((plan === undefined)
      || (candidate.manifestDigest !== manifest.manifestDigest)
      || (candidate.candidateOrdinal !== plan.ordinal)
      || (candidate.modelId !== plan.modelId)
      || (candidate.priority !== plan.priority))
      throw new Error('bounded verdict candidate authorization differs');
  }
}
