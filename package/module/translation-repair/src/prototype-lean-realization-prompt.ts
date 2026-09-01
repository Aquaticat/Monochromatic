// PROTOTYPE ONLY: Candidate L lean authors and candidate-scoped verifier prompts.

import type {
  ChatMessage,
  ContentPart,
} from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import { LEAN_FRONT_MATTER_AUTHORITY_DIGEST, } from './prototype-lean-realization-front-matter-contract.ts';
import { leanVerifierEvidence, } from './prototype-lean-realization-verifier-evidence.ts';
import type {
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  REVIEW_UNIT_FINDING_RULE_DIGEST,
  REVIEW_UNIT_FINDING_RULES,
} from './prototype-review-unit-rules.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Direct page-level realization without audit bookkeeping.
 */
const LEAN_AUTHOR_SYSTEM = 'Produce one complete publication-ready English page. Source is semantic authority; archive is wording evidence only and may contain defects. Own every fact, actor, attribution, identity, chronology, technical or legal term, contributor voice, idiomatic sentence boundary, unambiguous reference, grammar, tense, memorial register, source-calque avoidance, and source-image-target relation. Return every listed mutable value exactly once. For info.alias return exactly the source member count in source order, preserve every cased source identity member exactly at its position, and separate members with comma plus space. Return name equal to one returned alias member. Every front-matter scalar is nonempty and single-line. Runtime owns YAML, canonical alias joining, locked syntax, links, media paths, contributor identity, and target separators. Return no audit statuses, findings, alternatives, explanations, or Markdown outside values. Never invent, omit, summarize, or copy defective archive wording.';

/**
 * Complete readable candidate review with Candidate L front-matter ownership.
 */
const LEAN_VERIFIER_SYSTEM = 'Independently verify one anonymous complete candidate against source authority, archive wording evidence, readable reviewPlan, immutable shell, deterministic proof, and every image. Candidate slots, not reviewPlan archive targetText, are target authority. Return every binding exactly. frontMatterStatuses has one p preserved or d defect per candidate-authored front-matter path. clauseStatusesBySlot has one p or d per readable clause. relationStatuses has one p or d per ordered relation. slotLanguageStatuses has one c clean or d defect per candidate mutable value in supplied mutableSlotKeys order. globalStatuses covers every supplied global. Review all subjects. Let D be total d characters and C be findingCap. overflow equals D > C. Without overflow return one witness per d. With overflow return exactly first C defective subjects in canonical front-matter, clause, relation, language, then global order. Follow source, image, protected-identity, alias-order, and target-anchor rules. Never infer author identity or priority, revise prose, score, summarize, defer overlap, or omit status.';

/**
 * Candidate L substantive author identity.
 */
export const LEAN_REALIZATION_AUTHOR_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: LEAN_AUTHOR_SYSTEM,
    marker: 'LEAN_REALIZATION_AUTHOR_PACKET:',
    keys: [
      'manifestDigest',
      'frontMatterAuthorityDigest',
      'candidateOrdinal',
      'sourceText',
      'archiveText',
      'shell',
    ],
    outputCardinality: 'manifest-front-matter-plus-body-slots',
    frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
  },),
});

/**
 * Candidate L substantive verifier identity.
 */
export const LEAN_REALIZATION_VERIFIER_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: LEAN_VERIFIER_SYSTEM,
    marker: 'LEAN_REALIZATION_VERIFIER_PACKET:',
    languageCardinality: 'candidate-mutable-slot-keys',
    frontMatterCardinality: 'review-plan-front-matter-subjects',
    findingRuleDigest: REVIEW_UNIT_FINDING_RULE_DIGEST,
    frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
  },),
});

/**
 * Appends every manifested image after digest label.
 *
 * @returns Text packet followed by every page image
 */
function content({
  text,
  media,
  manifest,
}: {
  readonly text: string;
  readonly media: readonly PrototypeMedia[];
  readonly manifest: ReviewUnitManifest;
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
    throw new Error('lean realization media binding differs');
  return [
    {
      type: 'text',
      text,
    },
    ...media.flatMap(function image(item,): readonly ContentPart[] {
      if (hashContent({ content: item.dataUri, }) !== item.digest)
        throw new Error('lean realization media digest differs');
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
 * Builds direct Candidate L author conversation.
 *
 * @returns Prompt without obligation ledger or review plan
 *
 * @example
 * ```ts
 * const messages = leanRealizationAuthorMessages({ plan, manifest, shell, reviewPlan, sourceText, archiveText, media, });
 * ```
 */
export function leanRealizationAuthorMessages({
  plan,
  manifest,
  shell,
  reviewPlan,
  sourceText,
  archiveText,
  media,
}: {
  readonly plan: RealizationCandidatePlan;
  readonly manifest: ReviewUnitManifest;
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  /**
   * Canonical lean author packet without model identity or audit plan.
   */
  const packet = {
    manifestDigest: manifest.manifestDigest,
    frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
    candidateOrdinal: plan.ordinal,
    sourceText,
    archiveText,
    shell: {
      shellDigest: shell.shellDigest,
      bodySlots: shell.slots,
      frontMatterSlots: reviewPlan.frontMatterSubjects
        .map(function front(subject,) {
        return {
          key: subject.targetSlotKey,
          path: subject.path,
          sourceText: subject.sourceText,
        };
      },),
      targetBoundaries: manifest.targetBoundaries,
    },
  };
  return [
    {
      role: 'system',
      content: LEAN_AUTHOR_SYSTEM,
    },
    {
      role: 'user',
      content: content({
        text: `LEAN_REALIZATION_AUTHOR_PACKET:\n${JSON.stringify(packet,)}`,
        media,
        manifest,
      },),
    },
  ];
}

/**
 * Builds Candidate L candidate-scoped readable verifier conversation.
 *
 * @returns Complete candidate evidence and every page image
 *
 * @example
 * ```ts
 * const messages = leanRealizationVerifierMessages({ manifest, shell, reviewPlan, candidate, authorSettlementDigest, verifierPlanDigest, defectClasses, sourceText, archiveText, media, });
 * ```
 */
export function leanRealizationVerifierMessages({
  manifest,
  shell,
  reviewPlan,
  candidate,
  authorSettlementDigest,
  verifierPlanDigest,
  defectClasses,
  sourceText,
  archiveText,
  media,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
  readonly candidate: ReviewUnitCandidate;
  readonly authorSettlementDigest: string;
  readonly verifierPlanDigest: string;
  readonly defectClasses: readonly string[];
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  /**
   * Source-only and candidate-bound front-matter evidence.
   */
  const projected = leanVerifierEvidence({
    reviewPlan,
    candidate,
  });
  /**
   * Canonical candidate-scoped readable verifier packet.
   */
  const packet = {
    manifestDigest: manifest.manifestDigest,
    frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
    authorSettlementDigest,
    verifierPlanDigest,
    candidateOrdinal: candidate.candidateOrdinal,
    findingCap: manifest.findingCap,
    defectClasses,
    findingRuleDigest: REVIEW_UNIT_FINDING_RULE_DIGEST,
    findingRules: REVIEW_UNIT_FINDING_RULES,
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
      document: candidate.document,
      slots: candidate.slots,
      mutableSlotKeys: candidate.mutableSlotKeys,
      deterministicProofDigest: candidate.deterministicProofDigest,
    },
  };
  return [
    {
      role: 'system',
      content: LEAN_VERIFIER_SYSTEM,
    },
    {
      role: 'user',
      content: content({
        text: `LEAN_REALIZATION_VERIFIER_PACKET:\n${JSON.stringify(packet,)}`,
        media,
        manifest,
      },),
    },
  ];
}
