// PROTOTYPE ONLY: Candidate L complete candidate admission.

import { hashContent, } from './document-node.ts';
import { compileLeanFrontMatter, } from './prototype-lean-realization-front-matter.ts';
import { leanRealizationSlotKeys, } from './prototype-lean-realization-wire.ts';
import { assertReviewUnitsAuthorized, } from './prototype-review-unit-manifest.ts';
import type {
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import { compileReviewUnitFrontMatter, } from './prototype-review-unit-front-matter.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  assertReviewUnitProof,
  reviewUnitProofDigest,
  type ReviewUnitProofInput,
} from './prototype-review-unit-proof.ts';
import { realizationCandidateAlias, } from './prototype-realization-author.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import { validateSerialCandidate, } from './prototype-serial-producer-plan.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';
import { validateSlotCandidate, } from './prototype-slot-wire.ts';
import { compileCandidateBallotCandidate, } from './prototype-target-boundary-compile.ts';

/**
 * Runtime candidate digest excluding self reference.
 *
 * @param candidate - Candidate identity before self digest
 *
 * @returns Digest over every prior member
 */
function candidateDigest(candidate: Omit<ReviewUnitCandidate, 'candidateDigest'>,): string {
  return hashContent({ content: JSON.stringify(candidate,), });
}

/**
 * Refuses front-matter plan substitution after candidate compilation.
 */
function assertFrontMatterPlan({
  sourceText,
  document,
  reviewPlan,
}: {
  readonly sourceText: string;
  readonly document: string;
  readonly reviewPlan: ReviewUnitPlan;
}): void {
  /**
   * Candidate front-matter structure recomputed from assembled document.
   */
  const compiled = compileReviewUnitFrontMatter({
    sourceText,
    targetText: document,
  });
  /**
   * Candidate-independent subject identity from recomputation.
   */
  const stable = compiled.subjects
    .map(function subject(value,) {
    return {
      subjectIndex: value.subjectIndex,
      path: value.path,
      targetSlotKey: value.targetSlotKey,
      sourceText: value.sourceText,
      sourceDigest: value.sourceDigest,
    };
  },);
  /**
   * Manifested candidate-independent subject identity.
   */
  const expected = reviewPlan.frontMatterSubjects
    .map(function subject(value,) {
    return {
      subjectIndex: value.subjectIndex,
      path: value.path,
      targetSlotKey: value.targetSlotKey,
      sourceText: value.sourceText,
      sourceDigest: value.sourceDigest,
    };
  },);
  if ((JSON.stringify(stable,) !== JSON.stringify(expected,))
    || (compiled.structureDigest !== reviewPlan.frontMatterStructureDigest)
    || (compiled.scalarDigest !== reviewPlan.frontMatterScalarDigest))
    throw new Error('lean realization front matter plan differs');
}

/**
 * Shared manifest members required by authored front-matter compilation.
 */
type FrontMatterRealizationManifest = Pick<
  ReviewUnitManifest,
  | 'candidatePlan'
  | 'frontMatterAuthorityDigest'
  | 'ledgerDigest'
  | 'manifestDigest'
  | 'reviewPlanDigest'
  | 'shellDigest'
  | 'sourcePictures'
  | 'targetBoundaries'
> & {
  readonly authorMode: 'lean-realization' | 'risk-challenger';
};

/**
 * Admits one authored-front-matter 27-value response.
 *
 * @returns Complete candidate with authored front matter and runtime body syntax
 *
 * @example
 * ```ts
 * const candidate = admitFrontMatterRealizationResponse({ response, shell, manifest, reviewPlan, plan, sourceText, archiveText, sourcePictures, });
 * ```
 */
export function admitFrontMatterRealizationResponse({
  response,
  shell,
  manifest,
  reviewPlan,
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: SlotDocumentResponse;
  readonly shell: ImmutableShell;
  readonly manifest: FrontMatterRealizationManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): ReviewUnitCandidate {
  if ((manifest.authorMode !== 'lean-realization')
    && (manifest.authorMode !== 'risk-challenger'))
    throw new Error('front matter realization manifest mode differs');
  /**
   * Exact author plan authorized by manifest ordinal.
   */
  const authorized = manifest.candidatePlan
    .find(function ordinal(value,) {
    return value.ordinal === plan.ordinal;
  },);
  if ((authorized === undefined) || (JSON.stringify(authorized,) !== JSON.stringify(plan,)))
    throw new Error('lean realization author plan differs');
  /**
   * Body-only raw slots consumed by immutable shell compiler.
   */
  const bodySlots = Object.fromEntries(shell.slots
    .map(function body(slot,) {
    /**
     * Exact author text assigned to current body slot.
     */
    const value = response.slots[slot.key];
    if (value === undefined)
      throw new Error(`lean realization body slot ${slot.key} is absent`);
    return [
      slot.key,
      value,
    ];
  },),);
  /**
   * Body-only response passed to existing structural validator.
   */
  const bodyResponse = { slots: bodySlots, };
  /**
   * Existing complete body validation witness.
   */
  const rawValidation = validateSlotCandidate({
    shell,
    response: bodyResponse,
    sourceText,
    archiveText,
    sourcePictures,
  },);
  /**
   * Runtime-owned body syntax and separators.
   */
  const compilation = compileCandidateBallotCandidate({
    shell,
    response: bodyResponse,
    boundaries: manifest.targetBoundaries,
  },);
  /**
   * Runtime-owned normalized front-matter serialization.
   */
  const compiledFrontMatter = compileLeanFrontMatter({
    sourceText,
    response,
    reviewPlan,
  });
  /**
   * Compiled body with inherited archive front matter removed.
   */
  const body = compilation.document
    .slice(shell.frontMatter
      .length,);
  /**
   * Complete candidate using authored front matter and compiled body.
   */
  const document = `${compiledFrontMatter.frontMatter}${body}`;
  if (rawValidation.length === 0)
    throw new Error('lean realization body validation is absent');
  validateSerialCandidate({
    sourceText,
    archiveText,
    sourcePictures,
    candidate: document,
  });
  assertFrontMatterPlan({
    sourceText,
    document,
    reviewPlan,
  });
  /**
   * Exact target-anchor slots across front matter and body.
   */
  const slots = {
    ...compiledFrontMatter.slots,
    ...compilation.slots,
  };
  /**
   * Canonical 27-value language subject order.
   */
  const mutableSlotKeys = leanRealizationSlotKeys({
    shell,
    reviewPlan,
  });
  /**
   * Raw provider values retained for deterministic revalidation.
   */
  const rawSlots = Object.fromEntries(mutableSlotKeys.map(function raw(key,) {
    /**
     * Exact provider text for current mutable key.
     */
    const value = response.slots[key];
    if (value === undefined)
      throw new Error(`lean realization raw slot ${key} is absent`);
    return [
      key,
      value,
    ];
  },),);
  /**
   * Candidate members before deterministic proof attaches.
   */
  const admitted = {
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
    rawSlotDigest: hashContent({ content: JSON.stringify(rawSlots,), }),
    slots,
    rawSlots,
    mutableSlotKeys,
    frontMatterDigest: hashContent({ content: compiledFrontMatter.frontMatter, }),
    resolvedBoundaries: compilation.resolvedBoundaries,
  };
  /**
   * Mechanically decidable proof input.
   */
  const proofInput: ReviewUnitProofInput = {
    candidateId: admitted.candidateId,
    candidateOrdinal: admitted.candidateOrdinal,
    documentDigest: admitted.documentDigest,
    slotDigest: admitted.slotDigest,
    rawSlotDigest: admitted.rawSlotDigest,
    resolvedBoundaries: admitted.resolvedBoundaries,
    sourcePictureNames: sourcePictures.map(function name(picture,) { return picture.assetName; }),
  };
  /**
   * Candidate identity including deterministic proof.
   */
  const identity = {
    ...admitted,
    deterministicProofDigest: reviewUnitProofDigest({
      manifest,
      input: proofInput,
    }),
  };
  return {
    ...identity,
    candidateDigest: candidateDigest(identity,),
  };
}

/**
 * Admits one Candidate L response under lean-only manifest identity.
 *
 * @returns Complete Candidate L candidate
 *
 * @example
 * ```ts
 * const candidate = admitLeanRealizationResponse({ response, shell, manifest, reviewPlan, plan, sourceText, archiveText, sourcePictures, });
 * ```
 */
export function admitLeanRealizationResponse({
  response,
  shell,
  manifest,
  reviewPlan,
  plan,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly response: SlotDocumentResponse;
  readonly shell: ImmutableShell;
  readonly manifest: ReviewUnitManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly plan: RealizationCandidatePlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): ReviewUnitCandidate {
  if (manifest.authorMode !== 'lean-realization')
    throw new Error('lean realization manifest mode differs');
  /**
   * Lean-only manifest after explicit mode proof.
   */
  const leanManifest: FrontMatterRealizationManifest = {
    ...manifest,
    authorMode: 'lean-realization',
  };
  return admitFrontMatterRealizationResponse({
    response,
    shell,
    manifest: leanManifest,
    reviewPlan,
    plan,
    sourceText,
    archiveText,
    sourcePictures,
  });
}

/**
 * Revalidates one persisted Candidate L candidate.
 *
 * @example
 * ```ts
 * assertLeanRealizationBinding({ candidate, manifest, reviewPlan, shell, sourceText, archiveText, sourcePictures, });
 * ```
 */
export function assertLeanRealizationBinding({
  candidate,
  manifest,
  reviewPlan,
  shell,
  sourceText,
  archiveText,
  sourcePictures,
}: {
  readonly candidate: ReviewUnitCandidate;
  readonly manifest: ReviewUnitManifest;
  readonly reviewPlan: ReviewUnitPlan;
  readonly shell: ImmutableShell;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly sourcePictures: readonly { readonly assetName: string; }[];
}): void {
  assertReviewUnitsAuthorized({
    candidates: [candidate,],
    manifest,
  });
  /**
   * Candidate recomputed from raw slots and runtime authority.
   */
  const expected = admitLeanRealizationResponse({
    response: { slots: candidate.rawSlots, },
    shell,
    manifest,
    reviewPlan,
    plan: {
      ordinal: candidate.candidateOrdinal,
      modelId: candidate.modelId,
      priority: candidate.priority,
    },
    sourceText,
    archiveText,
    sourcePictures,
  });
  assertReviewUnitProof({
    manifest,
    input: {
      candidateId: candidate.candidateId,
      candidateOrdinal: candidate.candidateOrdinal,
      documentDigest: candidate.documentDigest,
      slotDigest: candidate.slotDigest,
      rawSlotDigest: candidate.rawSlotDigest,
      resolvedBoundaries: candidate.resolvedBoundaries,
      sourcePictureNames: sourcePictures.map(function name(picture,) { return picture.assetName; }),
    },
    expectedDigest: candidate.deterministicProofDigest,
  });
  if (JSON.stringify(candidate,) !== JSON.stringify(expected,))
    throw new Error('lean realization candidate binding differs');
}
