// PROTOTYPE ONLY: Candidate H complete immutable-shell author admission.

import { hashContent, } from './document-node.ts';
import { assertBoundedCandidatesAuthorized, } from './prototype-bounded-verdict-manifest.ts';
import type {
  BoundedCandidate,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import type { ImmutableShell, SlotDocumentResponse, } from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';

/** Runtime-owned candidate digest excluding self reference. */
function candidateDigest(
  candidate: Omit<BoundedCandidate, 'candidateDigest'>,
): string {
  return hashContent({ content: JSON.stringify(candidate,), });
}

/** Admits one complete slot map and attaches hidden author authority. */
export function admitBoundedAuthorResponse({
  response,
  shell,
  manifest,
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: SlotDocumentResponse;
  readonly shell: ImmutableShell;
  readonly manifest: BoundedVerdictManifest;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): BoundedCandidate {
  const authorized = manifest.candidatePlan.find(function ordinal(value,) {
    return value.ordinal === plan.ordinal;
  },);
  if ((authorized === undefined)
    || (JSON.stringify(authorized,) !== JSON.stringify(plan,)))
    throw new Error('bounded verdict author plan is not manifest-authorized');
  const document = validateSlotCandidate({
    shell,
    response,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  const slots = Object.fromEntries(shell.slots.map(function slot(item,) {
    const text = response.slots[item.key];
    if (text === undefined)
      throw new Error(`bounded verdict author slot ${item.key} is absent`);
    return [item.key, text,];
  },),);
  const identity = {
    candidateId: realizationCandidateAlias({
      manifestDigest: manifest.manifestDigest,
      ordinal: plan.ordinal,
    },),
    candidateOrdinal: plan.ordinal,
    manifestDigest: manifest.manifestDigest,
    modelId: plan.modelId,
    priority: plan.priority,
    document,
    documentDigest: hashContent({ content: document, }),
    slotDigest: hashContent({ content: JSON.stringify(slots,), }),
    slots,
  };
  return {
    ...identity,
    candidateDigest: candidateDigest(identity,),
  };
}

/** Revalidates persisted candidate against source and immutable bindings. */
export function assertBoundedCandidateBinding({
  candidate,
  manifest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly candidate: BoundedCandidate;
  readonly manifest: BoundedVerdictManifest;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  assertBoundedCandidatesAuthorized({ candidates: [candidate,], manifest, });
  const expected = admitBoundedAuthorResponse({
    response: { slots: candidate.slots, },
    shell,
    manifest,
    plan: {
      ordinal: candidate.candidateOrdinal,
      modelId: candidate.modelId,
      priority: candidate.priority,
    },
    sourceText,
    archiveText,
    sourcePictures,
  },);
  if (JSON.stringify(candidate,) !== JSON.stringify(expected,))
    throw new Error('bounded verdict candidate binding differs');
}
