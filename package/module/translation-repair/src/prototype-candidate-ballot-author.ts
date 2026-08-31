// PROTOTYPE ONLY: Candidate I complete author admission with runtime boundaries.

import { hashContent, } from './document-node.ts';
import { assertCandidateBallotsAuthorized, } from './prototype-candidate-ballot-manifest.ts';
import type {
  CandidateBallotCandidate,
  CandidateBallotManifest,
} from './prototype-candidate-ballot-model.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import { validateSerialCandidate, } from './prototype-serial-producer-plan.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';
import { compileCandidateBallotCandidate, } from './prototype-target-boundary-compile.ts';

/**
 * Runtime-owned candidate digest excluding self reference.
 *
 * @param candidate - Identity before self digest attaches
 *
 * @returns Digest binding every candidate member
 */
function candidateDigest(
  candidate: Omit<CandidateBallotCandidate, 'candidateDigest'>,
): string {
  return hashContent({ content: JSON.stringify(candidate,), });
}

/**
 * Admits one complete slot map and inserts manifested separators before hashing.
 *
 * @returns Runtime-bound complete candidate
 *
 * @example
 * ```ts
 * const candidate = admitCandidateBallotAuthorResponse({
 *   response,
 *   shell,
 *   manifest,
 *   plan,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 * });
 * ```
 */
export function admitCandidateBallotAuthorResponse({
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
  readonly manifest: CandidateBallotManifest;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): CandidateBallotCandidate {
  /**
   * Exact author plan authorized for supplied ordinal.
   */
  const authorized = manifest.candidatePlan
    .find(function ordinal(value,) {
    return value.ordinal === plan.ordinal;
  },);
  if ((authorized === undefined)
    || (JSON.stringify(authorized,) !== JSON.stringify(plan,)))
    throw new Error('candidate ballot author plan is not manifest-authorized');
  /**
   * Raw slot document proving model text satisfies immutable validation.
   */
  const rawDocument = validateSlotCandidate({
    shell,
    response,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  /**
   * Complete post-boundary candidate compiled before hashing.
   */
  const compilation = compileCandidateBallotCandidate({
    shell,
    response,
    boundaries: manifest.targetBoundaries,
  },);
  if (rawDocument.length === 0)
    throw new Error('candidate ballot raw validation document is absent');
  validateSerialCandidate({
    sourceText,
    archiveText,
    sourcePictures,
    candidate: compilation.document,
  },);
  /**
   * Slot record normalized into immutable shell order.
   */
  const rawSlots = Object.fromEntries(shell.slots
    .map(function slot(item,) {
    /**
     * Exact raw author text assigned to shell slot.
     */
    const text = response.slots[item.key];
    if (text === undefined)
      throw new Error(`candidate ballot author slot ${item.key} is absent`);
    return [
      item.key,
      text,
    ];
  },),);
  /**
   * Runtime-owned candidate members participating in self digest.
   */
  const identity = {
    candidateId: realizationCandidateAlias({
      manifestDigest: manifest.manifestDigest,
      ordinal: plan.ordinal,
    },),
    candidateOrdinal: plan.ordinal,
    manifestDigest: manifest.manifestDigest,
    modelId: plan.modelId,
    priority: plan.priority,
    document: compilation.document,
    documentDigest: hashContent({ content: compilation.document, }),
    slotDigest: hashContent({ content: JSON.stringify(compilation.slots,), }),
    rawSlotDigest: hashContent({ content: JSON.stringify(rawSlots,), }),
    slots: compilation.slots,
    rawSlots,
    resolvedBoundaries: compilation.resolvedBoundaries,
  };
  return {
    ...identity,
    candidateDigest: candidateDigest(identity,),
  };
}

/**
 * Revalidates persisted candidate against source and immutable bindings.
 *
 * @example
 * ```ts
 * assertCandidateBallotBinding({
 *   candidate,
 *   manifest,
 *   shell,
 *   sourceText,
 *   archiveText,
 *   sourcePictures,
 * });
 * ```
 */
export function assertCandidateBallotBinding({
  candidate,
  manifest,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly candidate: CandidateBallotCandidate;
  readonly manifest: CandidateBallotManifest;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  assertCandidateBallotsAuthorized({
    candidates: [candidate,],
    manifest,
  });
  /**
   * Candidate recomputed from raw slots and runtime authority.
   */
  const expected = admitCandidateBallotAuthorResponse({
    response: { slots: candidate.rawSlots, },
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
    throw new Error('candidate ballot candidate binding differs');
}
