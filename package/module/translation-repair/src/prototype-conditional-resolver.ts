// PROTOTYPE ONLY: Candidate E1 double-prime located resolver contract.

import type { ChatMessage, ContentPart, } from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import type {
  ConditionalAuditFinding,
  ConditionalAuditResponse,
} from './prototype-conditional-audit-model.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type { ImmutableShell, SlotDocumentResponse, } from './prototype-slot-model.ts';
import type { SlotAuthorNode, } from './prototype-slot-plan.ts';

export const CONDITIONAL_RESOLVER_NODE: SlotAuthorNode = {
  id: 'conditional-resolver',
  modelId: 'hf:moonshotai/Kimi-K3',
  priority: 0,
  role: 'conditional complete-document immutable-shell resolver',
};

export type LocatedConditionalFinding = ConditionalAuditFinding & {
  readonly support: number;
};

export function collectLocatedConditionalFindings(
  {
    audits,
    candidateId,
  }: {
    readonly audits: readonly ConditionalAuditResponse[];
    readonly candidateId: string;
  },
): readonly LocatedConditionalFinding[] {
  const counts = audits.reduce(function collect(accumulator, audit,) {
    for (const finding of audit.candidates[candidateId]?.findings ?? []) {
      const key = JSON.stringify([
        finding.slotKey,
        finding.defectClass,
        finding.sourceAnchor,
        finding.candidateAnchor,
      ],);
      const current = accumulator.get(key,);
      accumulator.set(key, {
        finding,
        support: (current?.support ?? 0) + 1,
      },);
    }
    return accumulator;
  }, new Map<string, { readonly finding: ConditionalAuditFinding; readonly support: number; }>(),);
  return [...counts.values(),]
    .map(function located(item,): LocatedConditionalFinding { return { ...item.finding, support: item.support, }; },)
    .toSorted(function stable(left, right,) {
      return left.slotKey.localeCompare(right.slotKey,)
        || left.defectClass.localeCompare(right.defectClass,)
        || left.sourceAnchor.localeCompare(right.sourceAnchor,)
        || left.candidateAnchor.localeCompare(right.candidateAnchor,);
    },);
}

export function changedConditionalSlotKeys(
  {
    baseline,
    resolution,
  }: {
    readonly baseline: SlotDocumentResponse;
    readonly resolution: SlotDocumentResponse;
  },
): readonly string[] {
  return Object.keys(baseline.slots,)
    .filter(function changed(key,) { return baseline.slots[key] !== resolution.slots[key]; },)
    .toSorted();
}

export function resolverChangedOnlyLocatedSlots(
  {
    baseline,
    resolution,
    findings,
  }: {
    readonly baseline: SlotDocumentResponse;
    readonly resolution: SlotDocumentResponse;
    readonly findings: readonly LocatedConditionalFinding[];
  },
): { readonly accepted: boolean; readonly changedSlotKeys: readonly string[]; } {
  const changedSlotKeys = changedConditionalSlotKeys({ baseline, resolution, });
  const located = new Set(findings.map(function slot(finding,) { return finding.slotKey; },),);
  return {
    accepted: (changedSlotKeys.length > 0)
      && changedSlotKeys.every(function allowed(key,) { return located.has(key,); }),
    changedSlotKeys,
  };
}

export function conditionalResolverMessages(
  {
    shell,
    sourceText,
    archiveText,
    baselineResponse,
    baselineDocument,
    findings,
    media,
  }: {
    readonly shell: ImmutableShell;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly baselineResponse: SlotDocumentResponse;
    readonly baselineDocument: string;
    readonly findings: readonly LocatedConditionalFinding[];
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const allowedSlotKeys = [...new Set(findings.map(function slot(finding,) { return finding.slotKey; },)),].toSorted();
  const system = `You are ${CONDITIONAL_RESOLVER_NODE.role}. Return one complete English slot record. Correct every actual located defect while preserving BASE values byte-for-byte for every slot outside ALLOWED SLOT KEYS. Do not edit an allowed slot unless needed to resolve located evidence. Own complete meaning, completeness, identity, actor, reference, chronology, technical and legal terminology, grammar, tense, register, idiomatic English, and whole-page coherence. Use source and archive as authority; auditor findings are evidence, not permission to change meaning. Inspect every image. Every value must be English and contain no Han-script source echo or visible line-break/control glyph. Shell owns structure, front matter, links, media, footnotes, comments, and order. Return each manifest key exactly once and plain prose values only.`;
  const contract = shell.slots.map(function slot(item,) {
    return {
      key: item.key,
      source: item.source,
      kind: item.kind,
      parentKind: item.parentKind,
      leftShellContext: shell.body.slice(Math.max(0, item.startOffset - 24,), item.startOffset,),
      rightShellContext: shell.body.slice(item.endOffset, item.endOffset + 24,),
    };
  },);
  const text = `SOURCE DOCUMENT:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nSLOT CONTRACT:\n${JSON.stringify(contract,)}\n\nLOCATED FINDINGS:\n${JSON.stringify(findings,)}\n\nALLOWED SLOT KEYS:\n${JSON.stringify(allowedSlotKeys,)}\n\nBASE SLOT RECORD:\n${JSON.stringify(baselineResponse,)}\n\nBASE DOCUMENT:\n${baselineDocument}`;
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
