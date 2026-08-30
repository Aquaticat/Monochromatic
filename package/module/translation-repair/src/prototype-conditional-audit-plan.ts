// PROTOTYPE ONLY: Candidate E auditor roster, schema, and image-bearing prompts.

import type { ChatMessage, ContentPart, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, VisionMessage, } from './chat-contract.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import {
  CONDITIONAL_DEFECT_CLASSES,
  type ConditionalAuditResponse,
  type ConditionalCandidate,
} from './prototype-conditional-audit-model.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import type { RosterModelId, } from './roster-id.ts';

const MAX_ANCHOR_CHARACTERS = 160;
const MAX_FINDINGS_PER_CANDIDATE = 46;

export type ConditionalAuditNode = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly role: string;
};

export const CONDITIONAL_AUDIT_NODES: readonly ConditionalAuditNode[] = [
  {
    id: 'fidelity-auditor',
    modelId: 'hf:moonshotai/Kimi-K3',
    role: 'source-fidelity and completeness auditor',
  },
  {
    id: 'language-auditor',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    role: 'English precision and source-calque auditor',
  },
  {
    id: 'relation-auditor',
    modelId: 'hf:zai-org/GLM-5.3-Flash',
    role: 'actor, chronology, reference, and register auditor',
  },
];

export function conditionalAuditResponseFormat(
  {
    shell,
    candidates,
  }: {
    readonly shell: ImmutableShell;
    readonly candidates: readonly ConditionalCandidate[];
  },
): JsonSchemaResponseFormat {
  const candidateProperties = Object.fromEntries(candidates.map(function candidate(item,) {
    return [item.id, {
      type: 'object',
      additionalProperties: false,
      required: ['findings',],
      properties: {
        findings: {
          type: 'array',
          maxItems: MAX_FINDINGS_PER_CANDIDATE,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['slotKey', 'defectClass', 'sourceAnchor', 'candidateAnchor',],
            properties: {
              slotKey: { type: 'string', enum: shell.slots.map(function key(slot,) { return slot.key; },), },
              defectClass: { type: 'string', enum: CONDITIONAL_DEFECT_CLASSES, },
              sourceAnchor: { type: 'string', minLength: 1, maxLength: MAX_ANCHOR_CHARACTERS, },
              candidateAnchor: { type: 'string', minLength: 1, maxLength: MAX_ANCHOR_CHARACTERS, },
            },
          },
        },
      },
    },];
  },),);
  return {
    type: 'json_schema',
    json_schema: {
      name: 'conditional_shell_audit',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['candidates',],
        properties: {
          candidates: {
            type: 'object',
            additionalProperties: false,
            required: candidates.map(function id(candidate,) { return candidate.id; },),
            properties: candidateProperties,
          },
        },
      },
    },
  };
}

export function conditionalAuditMessages(
  {
    node,
    shell,
    sourceText,
    archiveText,
    candidates,
    media,
  }: {
    readonly node: ConditionalAuditNode;
    readonly shell: ImmutableShell;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly candidates: readonly ConditionalCandidate[];
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const system = `You are ${node.role}. Independently inspect every candidate and every slot against full Chinese source, archive evidence, whole-page relations, and every image. Report only concrete material defects, never naturalness, preference, score, approval, or vague style. Allowed classes are ${CONDITIONAL_DEFECT_CLASSES.join(', ')}. Each finding must name manifest slot key and carry one exact nonempty quote from that source slot plus one exact nonempty quote from that candidate slot. For an omission, candidateAnchor is exact nearby wording where omitted proposition belongs. For unsupported addition, sourceAnchor is exact nearest source context. Keep anchors short. At most two distinct classes per candidate slot. Omit clear slots. Own complete fidelity, identity, attribution, actor, reference, chronology, terminology, grammar, tense, and register contract even when role emphasizes one class.`;
  const contract = shell.slots.map(function slot(item,) {
    return { key: item.key, source: item.source, kind: item.kind, parentKind: item.parentKind, };
  },);
  const candidateEvidence = candidates.map(function candidate(item,) {
    return {
      id: item.id,
      priority: item.priority,
      slots: item.response.slots,
      document: item.document,
    };
  },);
  const text = `SOURCE DOCUMENT:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nSLOT CONTRACT:\n${JSON.stringify(contract,)}\n\nCANDIDATES:\n${JSON.stringify(candidateEvidence,)}`;
  const content: readonly ContentPart[] = [
    { type: 'text', text, },
    ...media.flatMap(function image(item,): readonly ContentPart[] {
      return [
        { type: 'text', text: `MEDIA ${item.assetName}`, },
        { type: 'image_url', image_url: { url: item.dataUri, }, },
      ];
    },),
  ];
  return [
    { role: 'system', content: system, },
    { role: 'user', content, },
  ];
}

export function conditionalAuditGuard(
  {
    shell,
    candidates,
  }: {
    readonly shell: ImmutableShell;
    readonly candidates: readonly ConditionalCandidate[];
  },
): (value: unknown) => value is ConditionalAuditResponse {
  const candidateById = new Map(candidates.map(function pair(candidate,) {
    return [candidate.id, candidate,] as const;
  },),);
  const slotByKey = new Map(shell.slots.map(function pair(slot,) { return [slot.key, slot,] as const; },),);
  const candidateIds = candidates.map(function id(candidate,) { return candidate.id; },);
  return function isConditionalAuditResponse(value: unknown): value is ConditionalAuditResponse {
    if ((typeof value !== 'object') || (value === null) || !('candidates' in value))
      return false;
    const records = value.candidates;
    if ((typeof records !== 'object') || (records === null))
      return false;
    const actualIds = Object.keys(records,);
    if ((actualIds.length !== candidateIds.length) || candidateIds.some(function missing(id,) { return !actualIds.includes(id,); }))
      return false;
    return candidateIds.every(function validCandidate(id,) {
      const record = (records as Readonly<Record<string, unknown>>)[id];
      if ((typeof record !== 'object') || (record === null) || !('findings' in record) || !Array.isArray(record.findings,))
        return false;
      if (record.findings.length > MAX_FINDINGS_PER_CANDIDATE)
        return false;
      const candidate = candidateById.get(id,);
      if (candidate === undefined)
        return false;
      const seen = new Set<string>();
      return record.findings.every(function validFinding(finding,) {
        if ((typeof finding !== 'object') || (finding === null))
          return false;
        const item = finding as Partial<Record<keyof import('./prototype-conditional-audit-model.ts').ConditionalAuditFinding, unknown>>;
        if ((typeof item.slotKey !== 'string')
          || (typeof item.defectClass !== 'string')
          || !CONDITIONAL_DEFECT_CLASSES.includes(item.defectClass as typeof CONDITIONAL_DEFECT_CLASSES[number],)
          || (typeof item.sourceAnchor !== 'string')
          || (item.sourceAnchor.length === 0)
          || (item.sourceAnchor.length > MAX_ANCHOR_CHARACTERS)
          || (typeof item.candidateAnchor !== 'string')
          || (item.candidateAnchor.length === 0)
          || (item.candidateAnchor.length > MAX_ANCHOR_CHARACTERS))
          return false;
        const slot = slotByKey.get(item.slotKey,);
        const candidateSlot = candidate.response.slots[item.slotKey];
        if ((slot === undefined)
          || (candidateSlot === undefined)
          || !slot.source.includes(item.sourceAnchor,)
          || !candidateSlot.includes(item.candidateAnchor,))
          return false;
        const key = `${item.slotKey}:${item.defectClass}`;
        if (seen.has(key,))
          return false;
        seen.add(key,);
        return true;
      },);
    },);
  };
}
