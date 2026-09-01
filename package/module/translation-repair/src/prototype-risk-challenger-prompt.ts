// PROTOTYPE ONLY: Candidate M role-split whole-page challenger prompts.

import type {
  ChatMessage,
  ContentPart,
} from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import { leanVerifierEvidence, } from './prototype-lean-realization-verifier-evidence.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  CANDIDATE_M_ARCHITECTURE,
  CANDIDATE_M_DEFECT_CLASSES,
  type CandidateMChallengerRole,
  type CandidateMCandidate,
} from './prototype-risk-challenger-model.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import {
  CANDIDATE_M_CHALLENGER_RULE_DIGEST,
  CANDIDATE_M_CHALLENGER_RULES,
  CANDIDATE_M_FIDELITY_DEFECT_CLASSES,
  CANDIDATE_M_LANGUAGE_DEFECT_CLASSES,
  CANDIDATE_M_SHARED_DEFECT_CLASSES,
} from './prototype-risk-challenger-rules.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Fidelity challenger whole-page responsibility.
 */
const FIDELITY_SYSTEM = 'Read the complete source, archive, candidate, source-only review plan, deterministic proof, and every image. Challenge only fidelity: facts, actors, event ownership and sequence, relationships, chronology, causality, reference, omission, unsupported addition, identity, front-matter meaning, technical or legal terms, links, and source-image relation. Return clean with no finding only after reviewing the whole page. Otherwise return defect with exactly one first decisive, exactly anchored publication blocker. Shared actor-reference, event-ownership, and reference-attachment defects are valid vetoes. Never revise, summarize, rank, infer author identity, return status vectors, or omit bindings.';

/**
 * Publication-language challenger whole-page responsibility.
 */
const LANGUAGE_SYSTEM = 'Read the complete source, archive, candidate, source-only review plan, deterministic proof, and every image. Challenge only publication language and authority: grammar, idiom, sentence attachment, reference clarity, tense, register, paragraph coherence, source-language calque, memorial tone, contributor voice, and publication readiness across all mutable values. Return clean with no finding only after reviewing the whole page. Otherwise return defect with exactly one first decisive, exactly anchored publication blocker. Shared actor-reference, event-ownership, and reference-attachment defects are valid vetoes. Never revise, summarize, rank, infer author identity, return status vectors, or omit bindings.';

/**
 * Candidate M substantive challenger protocol identity.
 */
export const CANDIDATE_M_CHALLENGER_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    architecture: CANDIDATE_M_ARCHITECTURE,
    marker: 'RISK_CHALLENGER_PACKET:',
    systems: {
      fidelity: FIDELITY_SYSTEM,
      publicationLanguage: LANGUAGE_SYSTEM,
    },
    defectClasses: CANDIDATE_M_DEFECT_CLASSES,
    fidelityClasses: CANDIDATE_M_FIDELITY_DEFECT_CLASSES,
    languageClasses: CANDIDATE_M_LANGUAGE_DEFECT_CLASSES,
    sharedClasses: CANDIDATE_M_SHARED_DEFECT_CLASSES,
    ruleDigest: CANDIDATE_M_CHALLENGER_RULE_DIGEST,
    output: 'clean-empty-or-defect-one-finding',
  },),
});

/**
 * Appends every manifested image after digest label.
 *
 * @returns Canonical packet and all page images
 */
function content({
  text,
  media,
  manifest,
}: {
  readonly text: string;
  readonly media: readonly PrototypeMedia[];
  readonly manifest: CandidateMManifest;
}): readonly ContentPart[] {
  /**
   * Manifest-comparable image identities.
   */
  const bindings = media.map(function binding(item,) {
    return {
      assetName: item.assetName,
      digest: item.digest,
    };
  },);
  if (JSON.stringify(bindings,) !== JSON.stringify(manifest.sourcePictures,))
    throw new Error('risk challenger media binding differs');
  return [
    {
      type: 'text',
      text,
    },
    ...media.flatMap(function image(item,): readonly ContentPart[] {
      if (hashContent({ content: item.dataUri, }) !== item.digest)
        throw new Error('risk challenger media digest differs');
      return [
        {
          type: 'text',
          text: `MEDIA ${item.assetName} DIGEST ${item.digest}`,
        },
        {
          type: 'image_url',
          image_url: { url: item.dataUri, },
        },
      ];
    },),
  ];
}

/**
 * Builds one role-split complete-page challenge conversation.
 *
 * @returns Candidate-bound challenger messages and source-only plan digest
 *
 * @example
 * ```ts
 * const challenge = riskChallengerMessages({ role, manifest, shell, reviewPlan, candidate, authorSettlementDigest, challengerPlanDigest, sourceText, archiveText, media, });
 * ```
 */
export function riskChallengerMessages({
  role,
  manifest,
  shell,
  reviewPlan,
  candidate,
  authorSettlementDigest,
  challengerPlanDigest,
  sourceText,
  archiveText,
  media,
}: {
  readonly role: CandidateMChallengerRole;
  readonly manifest: CandidateMManifest;
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: CandidateMCandidate;
  readonly authorSettlementDigest: string;
  readonly challengerPlanDigest: string;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): {
  readonly messages: readonly (ChatMessage | VisionMessage)[];
  readonly sourceReviewPlanDigest: string;
} {
  /**
   * Source-only plan and candidate-bound front-matter evidence.
   */
  const projected = leanVerifierEvidence({
    reviewPlan,
    candidate,
  });
  /**
   * Canonical role-split challenge packet.
   */
  const packet = {
    architecture: manifest.architecture,
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest,
    challengerPlanDigest,
    role,
    challengerRuleDigest: manifest.verifierRuleDigest,
    challengerRules: CANDIDATE_M_CHALLENGER_RULES,
    sourceText,
    archiveText,
    shell: {
      shellDigest: shell.shellDigest,
      bodySlots: shell.slots,
      frontMatterSlots: projected.sourceReviewPlan
        .frontMatterSubjects,
      targetBoundaries: manifest.targetBoundaries,
    },
    sourceReviewPlanDigest: projected.sourceReviewPlanDigest,
    admissionReviewPlanDigest: projected.admissionReviewPlanDigest,
    reviewPlan: projected.sourceReviewPlan,
    candidateFrontMatterSubjects: projected.candidateFrontMatterSubjects,
    candidate: {
      candidateId: candidate.candidateId,
      candidateDigest: candidate.candidateDigest,
      deterministicProofDigest: candidate.deterministicProofDigest,
      document: candidate.document,
      slots: candidate.slots,
      mutableSlotKeys: candidate.mutableSlotKeys,
      riskAttestationDigest: candidate.riskAttestationDigest,
    },
  };
  return {
    messages: [
      {
        role: 'system',
        content: role === 'fidelity' ? FIDELITY_SYSTEM : LANGUAGE_SYSTEM,
      },
      {
        role: 'user',
        content: content({
          text: `RISK_CHALLENGER_PACKET:\n${JSON.stringify(packet,)}`,
          media,
          manifest,
        },),
      },
    ],
    sourceReviewPlanDigest: projected.sourceReviewPlanDigest,
  };
}
