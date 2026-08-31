// PROTOTYPE ONLY: Candidate G manifest-bound author and verifier prompts.

import type { ChatMessage, ContentPart, } from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import { hashContent, } from './document-node.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type {
  RealizationCandidatePlan,
  RealizationManifest,
  RealizationObligationLedger,
  RealizedCandidate,
} from './prototype-realization-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';

/** Exact canonical author system instruction hashed into manifest. */
const REALIZATION_AUTHOR_SYSTEM = 'Produce one complete publication-ready English candidate under immutable shell. Own full source fidelity, completeness, identities, contributor authority, relations, actor references, chronology, terminology, grammar, tense, register, and source-calque avoidance. Return every slot exactly once plus every obligation exactly once. Target anchors are UTF-16 half-open ranges inside returned slot text with SHA-256 digest of exact substring. Shell-owned obligations use no target anchors. Never invent, omit, summarize, explain, or emit Markdown outside slot text.';

/** Exact canonical verifier system instruction hashed into manifest. */
const REALIZATION_VERIFIER_SYSTEM = 'Independently verify every anonymous whole candidate against complete source, archive authority, obligation ledger, shell, and images. Mark every candidate-obligation pair preserved or defect and every global criterion clean or defect. Preserved source obligations require exact verified target anchors. Every defect status requires one matching located finding. Omission has no target anchor; every other finding has exact target anchor. Never infer author identity or priority, revise prose, score, summarize, or leave a matrix row absent.';

/** Ordered fields in exact canonical author packet. */
const REALIZATION_AUTHOR_PACKET_KEYS = [
  'manifestDigest',
  'candidateOrdinal',
  'sourceText',
  'archiveText',
  'shell',
  'ledger',
] as const;

/** Ordered fields in exact canonical verifier packet. */
const REALIZATION_VERIFIER_PACKET_KEYS = [
  'manifestDigest',
  'authorSettlementDigest',
  'verifierPlanDigest',
  'sourceText',
  'archiveText',
  'shell',
  'ledger',
  'candidates',
] as const;

/** Ordered fields exposed for one anonymous verifier candidate. */
const REALIZATION_VERIFIER_CANDIDATE_KEYS = [
  'candidateId',
  'candidateDigest',
  'document',
  'slots',
  'realization',
] as const;

/** Ordered fields in packet shell binding. */
const REALIZATION_PACKET_SHELL_KEYS = ['shellDigest', 'slots',] as const;

/** Canonical substantive author prompt and response contract digest. */
export const REALIZATION_AUTHOR_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: REALIZATION_AUTHOR_SYSTEM,
    packetMarker: 'AUTHOR_PACKET:',
    packetShape: {
      root: REALIZATION_AUTHOR_PACKET_KEYS,
      shell: REALIZATION_PACKET_SHELL_KEYS,
    },
    mediaLabel: 'MEDIA {assetName} DIGEST {digest}',
  },),
},);

/** Canonical substantive verifier prompt and response contract digest. */
export const REALIZATION_VERIFIER_PROTOCOL_DIGEST: string = hashContent({
  content: JSON.stringify({
    system: REALIZATION_VERIFIER_SYSTEM,
    packetMarker: 'VERIFIER_PACKET:',
    packetShape: {
      root: REALIZATION_VERIFIER_PACKET_KEYS,
      shell: REALIZATION_PACKET_SHELL_KEYS,
      candidate: REALIZATION_VERIFIER_CANDIDATE_KEYS,
    },
    mediaLabel: 'MEDIA {assetName} DIGEST {digest}',
  },),
},);

/** Refuses packet construction drift from protocol-hashed ordered keys. */
function assertRealizationPacketKeys({ value, expected, }: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly expected: readonly string[];
}): void {
  if (JSON.stringify(Object.keys(value,),) !== JSON.stringify(expected,))
    throw new Error('realization canonical prompt packet shape differs');
}

/** Refuses media substitution against exact manifest name and data-URI digest. */
export function assertRealizationMediaMatchesManifest({ media, manifest, }: {
  readonly media: readonly PrototypeMedia[];
  readonly manifest: RealizationManifest;
}): void {
  const actual = media.map(function binding(item,) {
    return { assetName: item.assetName, digest: item.digest, };
  },);
  if ((JSON.stringify(actual,) !== JSON.stringify(manifest.sourcePictures,))
    || media.some(function digest(item,) { return hashContent({ content: item.dataUri, }) !== item.digest; }))
    throw new Error('realization prompt media binding differs from manifest');
}

/** Appends every manifest-bound page image after exact asset label. */
function promptContent({ text, media, }: {
  readonly text: string;
  readonly media: readonly PrototypeMedia[];
}): readonly ContentPart[] {
  return [
    { type: 'text', text, },
    ...media.flatMap(function image(item,): readonly ContentPart[] {
      return [
        { type: 'text', text: `MEDIA ${item.assetName} DIGEST ${item.digest}`, },
        { type: 'image_url', image_url: { url: item.dataUri, }, },
      ];
    },),
  ];
}

/** Builds one canonical complete-candidate author conversation. */
export function realizationAuthorMessages({
  plan,
  manifest,
  shell,
  ledger,
  sourceText,
  archiveText,
  media,
}: {
  readonly plan: RealizationCandidatePlan;
  readonly manifest: RealizationManifest;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  assertRealizationMediaMatchesManifest({ media, manifest, });
  const system = REALIZATION_AUTHOR_SYSTEM;
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
  assertRealizationPacketKeys({ value: packet, expected: REALIZATION_AUTHOR_PACKET_KEYS, });
  assertRealizationPacketKeys({ value: packet.shell, expected: REALIZATION_PACKET_SHELL_KEYS, });
  return [
    { role: 'system', content: system, },
    { role: 'user', content: promptContent({ text: `AUTHOR_PACKET:\n${JSON.stringify(packet,)}`, media, }), },
  ];
}

/** Builds one canonical all-candidate complete-matrix verifier conversation. */
export function realizationVerifierMessages({
  manifest,
  shell,
  ledger,
  candidates,
  authorSettlementDigest,
  verifierPlanDigest,
  sourceText,
  archiveText,
  media,
}: {
  readonly manifest: RealizationManifest;
  readonly shell: ImmutableShell;
  readonly ledger: RealizationObligationLedger;
  readonly candidates: readonly RealizedCandidate[];
  readonly authorSettlementDigest: string;
  readonly verifierPlanDigest: string;
  readonly sourceText: string;
  readonly archiveText: string;
  readonly media: readonly PrototypeMedia[];
}): readonly (ChatMessage | VisionMessage)[] {
  assertRealizationMediaMatchesManifest({ media, manifest, });
  const system = REALIZATION_VERIFIER_SYSTEM;
  const candidateEvidence = candidates.map(function anonymous(candidate,) {
    const evidence = {
      candidateId: candidate.candidateId,
      candidateDigest: candidate.candidateDigest,
      document: candidate.document,
      slots: candidate.slots,
      realization: candidate.realization,
    };
    assertRealizationPacketKeys({ value: evidence, expected: REALIZATION_VERIFIER_CANDIDATE_KEYS, });
    return evidence;
  },);
  const packet = {
    manifestDigest: manifest.manifestDigest,
    authorSettlementDigest,
    verifierPlanDigest,
    sourceText,
    archiveText,
    shell: {
      shellDigest: shell.shellDigest,
      slots: shell.slots,
    },
    ledger,
    candidates: candidateEvidence,
  };
  assertRealizationPacketKeys({ value: packet, expected: REALIZATION_VERIFIER_PACKET_KEYS, });
  assertRealizationPacketKeys({ value: packet.shell, expected: REALIZATION_PACKET_SHELL_KEYS, });
  return [
    { role: 'system', content: system, },
    { role: 'user', content: promptContent({ text: `VERIFIER_PACKET:\n${JSON.stringify(packet,)}`, media, }), },
  ];
}
