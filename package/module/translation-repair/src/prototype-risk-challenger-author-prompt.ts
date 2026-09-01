// PROTOTYPE ONLY: Candidate M risk-attested author prompt.

import type {
  ChatMessage,
  ContentPart,
} from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import { LEAN_FRONT_MATTER_AUTHORITY_DIGEST, } from './prototype-lean-realization-front-matter-contract.ts';
import type { ReviewUnitPlan, } from './prototype-review-unit-plan.ts';
import {
  CANDIDATE_M_ARCHITECTURE,
  CANDIDATE_M_RISK_CODE,
  CANDIDATE_M_RISK_KEYS,
} from './prototype-risk-challenger-model.ts';
import type { CandidateMManifest, } from './prototype-risk-challenger-manifest-model.ts';
import type { RealizationCandidatePlan, } from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Candidate M complete author responsibility with explicit risk replay.
 */
const RISK_AUTHOR_SYSTEM = 'Produce one complete publication-ready English page from source authority, archive wording evidence, immutable syntax, and every image. Return every listed mutable value exactly once plus the exact riskAttestations object. Before answering, replay the whole source and candidate for actor attribution, event ownership and sequence, temporal and pronominal reference, unsupported emphasis, source-image relation, memorial register, and contributor voice. The checked codes only attest that you performed these checks; they do not certify quality. For info.alias return the exact source member count in source order, preserve every cased source identity member exactly at its position, and separate members with comma plus space. Return name equal to one returned alias member. Every front-matter scalar is nonempty and single-line. Runtime owns YAML, canonical alias joining, locked syntax, links, media paths, contributor identity, and target separators. Never invent, omit, summarize, alter an actor, transfer an action, copy defective archive wording, return audit findings, or add Markdown outside values.';

/**
 * Candidate M substantive author protocol identity.
 */
export const CANDIDATE_M_AUTHOR_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    architecture: CANDIDATE_M_ARCHITECTURE,
    system: RISK_AUTHOR_SYSTEM,
    marker: 'RISK_CHALLENGER_AUTHOR_PACKET:',
    riskKeys: CANDIDATE_M_RISK_KEYS,
    riskCode: CANDIDATE_M_RISK_CODE,
    output: '27-values-plus-six-ordered-attestations',
    frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
  },),
});

/**
 * Appends exact manifest images after digest labels.
 *
 * @returns Canonical text packet followed by every image
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
    throw new Error('risk challenger author media binding differs');
  return [
    {
      type: 'text',
      text,
    },
    ...media.flatMap(function image(item,): readonly ContentPart[] {
      if (hashContent({ content: item.dataUri, }) !== item.digest)
        throw new Error('risk challenger author media digest differs');
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
 * Builds one complete Candidate M author conversation.
 *
 * @returns Risk-attested author messages without verifier bookkeeping
 *
 * @example
 * ```ts
 * const messages = riskAttestedAuthorMessages({ plan, manifest, shell, reviewPlan, sourceText, archiveText, media, });
 * ```
 */
export function riskAttestedAuthorMessages({
  plan,
  manifest,
  shell,
  reviewPlan,
  sourceText,
  archiveText,
  media,
}: {
  readonly plan: RealizationCandidatePlan;
  readonly manifest: CandidateMManifest;
  readonly shell: ImmutableShell;
  readonly reviewPlan: ReviewUnitPlan;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  /**
   * Canonical risk-attested author packet.
   */
  const packet = {
    architecture: manifest.architecture,
    manifestDigest: manifest.manifestDigest,
    frontMatterAuthorityDigest: LEAN_FRONT_MATTER_AUTHORITY_DIGEST,
    riskPolicyDigest: manifest.riskPolicyDigest,
    riskAttestationDigest: manifest.riskAttestationDigest,
    riskRegister: CANDIDATE_M_RISK_KEYS,
    attestationCode: CANDIDATE_M_RISK_CODE,
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
      content: RISK_AUTHOR_SYSTEM,
    },
    {
      role: 'user',
      content: content({
        text: `RISK_CHALLENGER_AUTHOR_PACKET:\n${JSON.stringify(packet,)}`,
        media,
        manifest,
      },),
    },
  ];
}
