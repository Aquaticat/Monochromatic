// PROTOTYPE ONLY: Candidate H manifest-bound author and verifier prompts.

import type {
  ChatMessage,
  ContentPart,
} from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type {
  BoundedCandidate,
  BoundedVerdictManifest,
} from './prototype-bounded-verdict-model.ts';
import type {
  RealizationCandidatePlan,
  RealizationObligationLedger,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/**
 * Canonical author instruction retaining full quality ownership.
 */
const BOUNDED_AUTHOR_SYSTEM = 'Produce one complete publication-ready English candidate under immutable shell. Own full source fidelity, completeness, identities, contributor authority, relations, actor references, chronology, terminology, grammar, tense, register, and source-calque avoidance. Return every slot exactly once. Use the obligation ledger as a closed-world completeness checklist, but return no audit claims. Never invent, omit, summarize, explain, or emit Markdown outside slot text.';

/**
 * Canonical verifier instruction for compact complete status matrices.
 */
const BOUNDED_VERIFIER_SYSTEM = 'Independently verify every anonymous whole candidate against complete source, archive authority, obligation ledger, shell, and images. Return candidates in supplied order. For each candidate return one obligation code per ledger obligation in manifest order: p preserved or d defect. Return one global code per supplied criterion in canonical order: c clean or d defect. Let D be total d codes and C be manifested findingCap. overflow must equal D > C. When overflow is false, return exactly one unique indexed finding for every d code. When overflow is true, return exactly C unique findings linked to distinct d codes. Obligation omission findings need no target anchor; omission is forbidden for global findings. Every other finding needs exact UTF-16 half-open target anchors with SHA-256 substring digests. Never infer author identity or priority, revise prose, score, summarize, or omit a matrix row.';

/**
 * Canonical author packet field order.
 */
const BOUNDED_AUTHOR_PACKET_KEYS = [
  'manifestDigest',
  'candidateOrdinal',
  'sourceText',
  'archiveText',
  'shell',
  'ledger',
] as const;

/**
 * Canonical verifier packet field order.
 */
const BOUNDED_VERIFIER_PACKET_KEYS = [
  'manifestDigest',
  'authorSettlementDigest',
  'verifierPlanDigest',
  'findingCap',
  'globalCriteria',
  'defectClasses',
  'sourceText',
  'archiveText',
  'shell',
  'ledger',
  'candidates',
] as const;

/**
 * Anonymous candidate evidence field order.
 */
const BOUNDED_CANDIDATE_KEYS = [
  'candidateId',
  'candidateDigest',
  'document',
  'slots',
] as const;

/**
 * Shell packet field order.
 */
const BOUNDED_SHELL_KEYS = [
  'shellDigest',
  'slots',
] as const;

/**
 * Canonical Candidate H author protocol identity.
 */
export const BOUNDED_AUTHOR_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: BOUNDED_AUTHOR_SYSTEM,
    packetMarker: 'BOUNDED_AUTHOR_PACKET:',
    packetKeys: BOUNDED_AUTHOR_PACKET_KEYS,
    shellKeys: BOUNDED_SHELL_KEYS,
    mediaLabel: 'MEDIA {assetName} DIGEST {digest}',
  },),
});

/**
 * Canonical Candidate H verifier protocol identity.
 */
export const BOUNDED_VERIFIER_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: BOUNDED_VERIFIER_SYSTEM,
    packetMarker: 'BOUNDED_VERIFIER_PACKET:',
    packetKeys: BOUNDED_VERIFIER_PACKET_KEYS,
    candidateKeys: BOUNDED_CANDIDATE_KEYS,
    shellKeys: BOUNDED_SHELL_KEYS,
    mediaLabel: 'MEDIA {assetName} DIGEST {digest}',
  },),
});

/**
 * Refuses accidental packet-shape drift from protocol digest.
 */
function assertKeys({
  value,
  expected,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[];
}): void {
  if (JSON.stringify(Object.keys(value,),) !== JSON.stringify(expected,))
    throw new Error('bounded verdict canonical prompt packet shape differs');
}

/**
 * Refuses image substitution against manifest bindings.
 *
 * @example
 * ```ts
 * assertBoundedMedia({ media, manifest, });
 * ```
 */
export function assertBoundedMedia({
  media,
  manifest,
}: {
  readonly media: readonly PrototypeMedia[];
  readonly manifest: BoundedVerdictManifest;
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
    throw new Error('bounded verdict prompt media binding differs from manifest');
}

/**
 * Appends every page-referenced image after bound label.
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
 * const messages = boundedAuthorMessages({
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
export function boundedAuthorMessages({
  plan,
  manifest,
  shell,
  ledger,
  sourceText,
  archiveText,
  media,
}: {
  readonly plan: RealizationCandidatePlan;
  readonly manifest: BoundedVerdictManifest;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  assertBoundedMedia({
    media,
    manifest,
  });
  /**
   * Canonical author packet with no model identity or hidden priority.
   */
  const packet = {
    manifestDigest: manifest.manifestDigest,
    candidateOrdinal: plan.ordinal,
    sourceText,
    archiveText,
    shell: {
      shellDigest: shell.shellDigest,
      slots: shell.slots,
    },
    ledger,
  };
  assertKeys({
    value: packet,
    expected: BOUNDED_AUTHOR_PACKET_KEYS,
  });
  assertKeys({
    value: packet.shell,
    expected: BOUNDED_SHELL_KEYS,
  });
  return [
    {
      role: 'system',
      content: BOUNDED_AUTHOR_SYSTEM,
    },
    {
      role: 'user',
      content: promptContent({
        text: `BOUNDED_AUTHOR_PACKET:\n${JSON.stringify(packet,)}`,
        media,
      },),
    },
  ];
}

/**
 * Builds canonical all-candidate bounded verifier conversation.
 *
 * @returns Anonymous verifier messages carrying every candidate and page image
 *
 * @example
 * ```ts
 * const messages = boundedVerifierMessages({
 *   manifest,
 *   shell,
 *   ledger,
 *   candidates,
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
export function boundedVerifierMessages({
  manifest,
  shell,
  ledger,
  candidates,
  authorSettlementDigest,
  verifierPlanDigest,
  globalCriteria,
  defectClasses,
  sourceText,
  archiveText,
  media,
}: {
  readonly manifest: BoundedVerdictManifest;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly BoundedCandidate[];
  readonly authorSettlementDigest: string;
  readonly verifierPlanDigest: string;
  readonly globalCriteria: readonly string[];
  readonly defectClasses: readonly string[];
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  assertBoundedMedia({
    media,
    manifest,
  });
  /**
   * Candidate evidence stripped of model identity and priority.
   */
  const anonymousCandidates = candidates.map(function anonymous(candidate,) {
    /**
     * Exact public evidence for one anonymous candidate.
     */
    const evidence = {
      candidateId: candidate.candidateId,
      candidateDigest: candidate.candidateDigest,
      document: candidate.document,
      slots: candidate.slots,
    };
    assertKeys({
      value: evidence,
      expected: BOUNDED_CANDIDATE_KEYS,
    });
    return evidence;
  },);
  /**
   * Canonical verifier packet bound to settlement and dynamic plan.
   */
  const packet = {
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest,
    verifierPlanDigest,
    findingCap: manifest.findingCap,
    globalCriteria,
    defectClasses,
    sourceText,
    archiveText,
    shell: {
      shellDigest: shell.shellDigest,
      slots: shell.slots,
    },
    ledger,
    candidates: anonymousCandidates,
  };
  assertKeys({
    value: packet,
    expected: BOUNDED_VERIFIER_PACKET_KEYS,
  });
  assertKeys({
    value: packet.shell,
    expected: BOUNDED_SHELL_KEYS,
  });
  return [
    {
      role: 'system',
      content: BOUNDED_VERIFIER_SYSTEM,
    },
    {
      role: 'user',
      content: promptContent({
        text: `BOUNDED_VERIFIER_PACKET:\n${JSON.stringify(packet,)}`,
        media,
      },),
    },
  ];
}
