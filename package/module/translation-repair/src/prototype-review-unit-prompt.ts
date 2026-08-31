// PROTOTYPE ONLY: Candidate K manifest-bound author and candidate-scoped prompts.

import type {
  ChatMessage,
  ContentPart,
} from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type {
  ReviewUnitCandidate,
  ReviewUnitManifest,
} from './prototype-review-unit-model.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Canonical complete-candidate author quality contract.
 */
const REVIEW_UNIT_AUTHOR_SYSTEM = 'Produce one complete publication-ready English candidate under immutable shell. Own full source fidelity, completeness, identities, contributor authority, relations, actor references, chronology, terminology, grammar, tense, register, and source-calque avoidance. Return every slot exactly once. Runtime owns manifested target-language separators adjacent to locked syntax; do not encode or discuss them. Use obligation ledger as closed-world completeness checklist, but return no audit claims. Never invent, omit, summarize, explain, or emit Markdown outside slot text.';

/**
 * Canonical one-candidate verifier quality contract.
 */
const REVIEW_UNIT_VERIFIER_SYSTEM = 'Independently verify one anonymous whole candidate against complete source, archive authority, obligation ledger, immutable shell, runtime-owned target boundaries, and every image. Return candidate id and digest exactly. obligationStatuses is exactly one character per ledger obligation in manifest order: p preserved or d defect. globalStatuses is exactly one character per supplied criterion in canonical order: c clean or d defect. Let D be total d characters and C be findingCap. overflow must equal D > C. When overflow is false, return exactly one unique indexed finding for every d. When overflow is true, return exactly C unique findings linked to distinct d subjects. Obligation omission needs no target anchor; omission is forbidden for global findings. Every other finding needs exact UTF-16 half-open target anchors with SHA-256 substring digests. Never infer author identity or priority, revise prose, score, summarize, or omit any status.';

/**
 * Canonical author packet fields.
 */
const AUTHOR_PACKET_KEYS = [
  'manifestDigest',
  'candidateOrdinal',
  'sourceText',
  'archiveText',
  'shell',
  'ledger',
] as const;

/**
 * Canonical candidate-scoped verifier packet fields.
 */
const VERIFIER_PACKET_KEYS = [
  'manifestDigest',
  'authorSettlementDigest',
  'verifierPlanDigest',
  'candidateOrdinal',
  'findingCap',
  'globalCriteria',
  'defectClasses',
  'sourceText',
  'archiveText',
  'shell',
  'ledger',
  'candidate',
] as const;

/**
 * Anonymous candidate evidence fields.
 */
const CANDIDATE_KEYS = [
  'candidateId',
  'candidateDigest',
  'document',
  'slots',
] as const;

/**
 * Shell evidence fields including runtime-owned boundaries.
 */
const SHELL_KEYS = [
  'shellDigest',
  'slots',
  'targetBoundaries',
] as const;

/**
 * Canonical Candidate K author protocol identity.
 */
export const REVIEW_UNIT_AUTHOR_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: REVIEW_UNIT_AUTHOR_SYSTEM,
    packetMarker: 'REVIEW_UNIT_AUTHOR_PACKET:',
    packetKeys: AUTHOR_PACKET_KEYS,
    shellKeys: SHELL_KEYS,
    mediaLabel: 'MEDIA {assetName} DIGEST {digest}',
  },),
});

/**
 * Canonical Candidate K verifier protocol identity.
 */
export const REVIEW_UNIT_VERIFIER_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: REVIEW_UNIT_VERIFIER_SYSTEM,
    packetMarker: 'REVIEW_UNIT_VERIFIER_PACKET:',
    packetKeys: VERIFIER_PACKET_KEYS,
    candidateKeys: CANDIDATE_KEYS,
    shellKeys: SHELL_KEYS,
    mediaLabel: 'MEDIA {assetName} DIGEST {digest}',
  },),
});

/**
 * Refuses packet-shape drift from protocol digest.
 */
function assertKeys({
  value,
  expected,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[];
}): void {
  if (JSON.stringify(Object.keys(value,),) !== JSON.stringify(expected,))
    throw new Error('review unit canonical prompt packet shape differs');
}

/**
 * Refuses image substitution against manifest binding.
 *
 * @example
 * ```ts
 * assertReviewUnitMedia({ media, manifest, });
 * ```
 */
export function assertReviewUnitMedia({
  media,
  manifest,
}: {
  readonly media: readonly PrototypeMedia[];
  readonly manifest: ReviewUnitManifest;
}): void {
  /**
   * Exact name and data-URI digest bindings carried by prompt media.
   */
  const actual = media.map(function binding(item,) {
    return {
      assetName: item.assetName,
      digest: item.digest,
    };
  },);
  if ((JSON.stringify(actual,) !== JSON.stringify(manifest.sourcePictures,))
    || media.some(function digest(item,) {
      return hashContent({ content: item.dataUri, }) !== item.digest;
    },))
    throw new Error('review unit prompt media binding differs from manifest');
}

/**
 * Appends every page image after bound label.
 *
 * @returns Text packet followed by every labeled image payload
 */
function promptContent({
  text,
  media,
}: {
  readonly text: string;
  readonly media: readonly PrototypeMedia[];
}): readonly ContentPart[] {
  return [
    {
      type: 'text',
      text,
    },
    ...media.flatMap(function image(item,): readonly ContentPart[] {
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
 * Builds canonical complete slot-author conversation.
 *
 * @returns Manifest-bound author messages carrying every page image
 *
 * @example
 * ```ts
 * const messages = reviewUnitAuthorMessages({
 *   plan,
 *   manifest,
 *   shell,
 *   ledger,
 *   sourceText,
 *   archiveText,
 *   media,
 * });
 * ```
 */
export function reviewUnitAuthorMessages({
  plan,
  manifest,
  shell,
  ledger,
  sourceText,
  archiveText,
  media,
}: {
  readonly plan: RealizationCandidatePlan;
  readonly manifest: ReviewUnitManifest;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  assertReviewUnitMedia({
    media,
    manifest,
  });
  /**
   * Canonical author packet without model identity or hidden priority.
   */
  const packet = {
    manifestDigest: manifest.manifestDigest,
    candidateOrdinal: plan.ordinal,
    sourceText,
    archiveText,
    shell: {
      shellDigest: shell.shellDigest,
      slots: shell.slots,
      targetBoundaries: manifest.targetBoundaries,
    },
    ledger,
  };
  assertKeys({
    value: packet,
    expected: AUTHOR_PACKET_KEYS,
  });
  assertKeys({
    value: packet.shell,
    expected: SHELL_KEYS,
  });
  return [
    {
      role: 'system',
      content: REVIEW_UNIT_AUTHOR_SYSTEM,
    },
    {
      role: 'user',
      content: promptContent({
        text: `REVIEW_UNIT_AUTHOR_PACKET:\n${JSON.stringify(packet,)}`,
        media,
      },),
    },
  ];
}

/**
 * Builds canonical one-candidate verifier conversation.
 *
 * @returns Candidate-scoped verifier messages carrying every page image
 *
 * @example
 * ```ts
 * const messages = reviewUnitVerifierMessages({
 *   manifest,
 *   shell,
 *   ledger,
 *   candidate,
 *   authorSettlementDigest,
 *   verifierPlanDigest,
 *   globalCriteria,
 *   defectClasses,
 *   sourceText,
 *   archiveText,
 *   media,
 * });
 * ```
 */
export function reviewUnitVerifierMessages({
  manifest,
  shell,
  ledger,
  candidate,
  authorSettlementDigest,
  verifierPlanDigest,
  globalCriteria,
  defectClasses,
  sourceText,
  archiveText,
  media,
}: {
  readonly manifest: ReviewUnitManifest;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly candidate: ReviewUnitCandidate;
  readonly authorSettlementDigest: string;
  readonly verifierPlanDigest: string;
  readonly globalCriteria: readonly string[];
  readonly defectClasses: readonly string[];
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  assertReviewUnitMedia({
    media,
    manifest,
  });
  /**
   * Exact public evidence for anonymous candidate.
   */
  const evidence = {
    candidateId: candidate.candidateId,
    candidateDigest: candidate.candidateDigest,
    document: candidate.document,
    slots: candidate.slots,
  };
  assertKeys({
    value: evidence,
    expected: CANDIDATE_KEYS,
  });
  /**
   * Candidate-scoped packet with ordinal preventing prompt alias collision.
   */
  const packet = {
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest,
    verifierPlanDigest,
    candidateOrdinal: candidate.candidateOrdinal,
    findingCap: manifest.findingCap,
    globalCriteria,
    defectClasses,
    sourceText,
    archiveText,
    shell: {
      shellDigest: shell.shellDigest,
      slots: shell.slots,
      targetBoundaries: manifest.targetBoundaries,
    },
    ledger,
    candidate: evidence,
  };
  assertKeys({
    value: packet,
    expected: VERIFIER_PACKET_KEYS,
  });
  assertKeys({
    value: packet.shell,
    expected: SHELL_KEYS,
  });
  return [
    {
      role: 'system',
      content: REVIEW_UNIT_VERIFIER_SYSTEM,
    },
    {
      role: 'user',
      content: promptContent({
        text: `REVIEW_UNIT_VERIFIER_PACKET:\n${JSON.stringify(packet,)}`,
        media,
      },),
    },
  ];
}
