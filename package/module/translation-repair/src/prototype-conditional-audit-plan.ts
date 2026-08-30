// PROTOTYPE ONLY: Candidate E auditor roster, schema, and image-bearing prompts.

import type { ChatMessage, ContentPart, } from '@monochromatic-dev/module-llm-type/ts';

import type { JsonSchemaResponseFormat, VisionMessage, } from './chat-contract.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import {
  CONDITIONAL_DEFECT_CLASSES,
  type ConditionalAuditAdmission,
  type ConditionalAuditFinding,
  type ConditionalAuditResponse,
  type ConditionalCandidate,
  type ConditionalRejectedFinding,
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

export function conditionalAuditStructuralGuard(
  {
    shell,
    candidates,
  }: {
    readonly shell: ImmutableShell;
    readonly candidates: readonly ConditionalCandidate[];
  },
): (value: unknown) => value is ConditionalAuditResponse {
  const slotKeys = new Set(shell.slots.map(function key(slot,) { return slot.key; },),);
  const candidateIds = candidates.map(function id(candidate,) { return candidate.id; },);
  return function isStructurallyValidAudit(value: unknown): value is ConditionalAuditResponse {
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
      return record.findings.every(function validFinding(finding,) {
        if ((typeof finding !== 'object') || (finding === null))
          return false;
        const item = finding as Partial<Record<keyof ConditionalAuditFinding, unknown>>;
        return (typeof item.slotKey === 'string')
          && slotKeys.has(item.slotKey,)
          && (typeof item.defectClass === 'string')
          && CONDITIONAL_DEFECT_CLASSES.includes(item.defectClass as typeof CONDITIONAL_DEFECT_CLASSES[number],)
          && (typeof item.sourceAnchor === 'string')
          && (item.sourceAnchor.length > 0)
          && (item.sourceAnchor.length <= MAX_ANCHOR_CHARACTERS)
          && (typeof item.candidateAnchor === 'string')
          && (item.candidateAnchor.length > 0)
          && (item.candidateAnchor.length <= MAX_ANCHOR_CHARACTERS);
      },);
    },);
  };
}

export function admitConditionalAudit(
  {
    shell,
    candidates,
    response,
  }: {
    readonly shell: ImmutableShell;
    readonly candidates: readonly ConditionalCandidate[];
    readonly response: ConditionalAuditResponse;
  },
): ConditionalAuditAdmission {
  const slotByKey = new Map(shell.slots.map(function pair(slot,) { return [slot.key, slot,] as const; },),);
  const admissions = candidates.map(function candidateAdmission(candidate,) {
    const seen = new Set<string>();
    const findings = response.candidates[candidate.id]?.findings ?? [];
    const classified = findings.map(function classify(finding,) {
      const key = `${finding.slotKey}:${finding.defectClass}`;
      const sourceSlot = slotByKey.get(finding.slotKey,);
      const candidateSlot = candidate.response.slots[finding.slotKey];
      const reason: ConditionalRejectedFinding['reason'] | undefined =
        ((sourceSlot === undefined) || !sourceSlot.source.includes(finding.sourceAnchor,))
          ? 'source-anchor-unbound'
          : ((candidateSlot === undefined) || !candidateSlot.includes(finding.candidateAnchor,))
            ? 'candidate-anchor-unbound'
            : seen.has(key,)
              ? 'duplicate-key'
              : undefined;
      seen.add(key,);
      return { finding, reason, };
    },);
    return { candidate, classified, };
  },);
  return {
    response: {
      candidates: Object.fromEntries(admissions.map(function admitted(admission,) {
        return [admission.candidate.id, {
          findings: admission.classified.flatMap(function keep(item,): readonly ConditionalAuditFinding[] {
            return item.reason === undefined ? [item.finding,] : [];
          },),
        },];
      },),),
    },
    rejectedFindings: admissions.flatMap(function rejected(admission,) {
      return admission.classified.flatMap(function evidence(item,): readonly ConditionalRejectedFinding[] {
        return item.reason === undefined ? [] : [{
          candidateId: admission.candidate.id,
          slotKey: item.finding.slotKey,
          defectClass: item.finding.defectClass,
          reason: item.reason,
        },];
      },);
    },),
  };
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
  const structurallyValid = conditionalAuditStructuralGuard({ shell, candidates, });
  return function isStrictlyValidAudit(value: unknown): value is ConditionalAuditResponse {
    return structurallyValid(value,)
      && (admitConditionalAudit({ shell, candidates, response: value, }).rejectedFindings.length === 0);
  };
}
