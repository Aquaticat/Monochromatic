// PROTOTYPE ONLY: Candidate C fixed plan, prompts, and deterministic admission.

import { archiveContributorNameForms, } from './contributor-name-authority.ts';
import { parseDocument, } from './parse-document.ts';
import type { PreparationBrief, BriefEditorDocument, } from './prototype-brief-editor-wire.ts';
import { validateSerialCandidate, } from './prototype-serial-producer-plan.ts';
import type { RosterModelId, } from './roster-id.ts';

export type BriefNode = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly domains: readonly ('source' | 'archive' | 'media')[];
  readonly defectClasses: readonly string[];
  readonly responsibility: string;
};

export const BRIEF_NODES: readonly BriefNode[] = [
  {
    id: 'source-brief',
    modelId: 'hf:moonshotai/Kimi-K3',
    domains: ['source',],
    defectClasses: ['wrong-meaning', 'omission', 'addition', 'identity-change', 'attribution', 'ambiguity',],
    responsibility: 'Locate source propositions, ambiguity, identity, attribution, omission risk, and meaning constraints. Do not draft English.',
  },
  {
    id: 'structure-brief',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    domains: ['source', 'archive', 'media',],
    defectClasses: ['structure', 'link', 'media', 'formatting', 'paragraph-relation', 'footnote',],
    responsibility: 'Locate document relations, links, media-derived content, formatting, paragraph boundaries, and footnote obligations. Inspect every supplied image. Do not draft English.',
  },
  {
    id: 'expression-brief',
    modelId: 'hf:openai/gpt-oss-120b',
    domains: ['archive',],
    defectClasses: ['grammar', 'usage', 'unclear-reference', 'tense-inconsistency', 'register-mismatch', 'repetition',],
    responsibility: 'Locate concrete grammar, usage, reference, tense, register, and repetition instructions grounded in archive wording. Do not assign an aggregate quality verdict and do not draft replacement prose.',
  },
];

export type EditorNode = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly priority: number;
};

export const EDITOR_NODES: readonly EditorNode[] = [
  { id: 'primary-editor', modelId: 'hf:moonshotai/Kimi-K3', priority: 0, },
  { id: 'fallback-editor', modelId: 'hf:Qwen/Qwen3.8-27B', priority: 1, },
];

export type SourceUnit = {
  readonly id: string;
  readonly kind: string;
  readonly text: string;
};

export type LocatedBriefItem = {
  readonly briefId: string;
  readonly authorNodeId: string;
  readonly anchorDomain: 'source' | 'archive' | 'media';
  readonly anchor: string;
  readonly defectClass: string;
  readonly instruction: string;
};

export type EditorialPacket = {
  readonly sourceUnits: readonly SourceUnit[];
  readonly lockedContributorForms: readonly string[];
  readonly mediaNames: readonly string[];
  readonly missingBriefNodes: readonly string[];
  readonly items: readonly LocatedBriefItem[];
};

export function sourceUnitsFor({ sourceText, }: { readonly sourceText: string; }): readonly SourceUnit[] {
  return parseDocument({ text: sourceText, }).nodes.map(function toUnit(node,) {
    return { id: node.id, kind: node.kind, text: node.text, };
  },);
}

export function briefSystemInstruction(
  {
    responsibility,
    domains,
    defectClasses,
  }: {
    readonly responsibility: string;
    readonly domains: readonly string[];
    readonly defectClasses: readonly string[];
  },
): string {
  return `You are a pre-authorship specialist. ${responsibility} Return only finite located instructions that an accountable whole-document editor can act on. anchorDomain must be one of ${domains.join(', ')}. defectClass must be one of ${defectClasses.join(', ')}. A source or archive anchor must be an exact nonempty substring of its named document. A media anchor must be exact supplied asset name. Report no candidate verdict because no candidate exists. Empty items is valid when no concrete instruction exists.`;
}

export function validatePreparationBrief(
  {
    brief,
    sourceText,
    archiveText,
    mediaNames,
    domains,
    defectClasses,
  }: {
    readonly brief: PreparationBrief;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly mediaNames: ReadonlySet<string>;
    readonly domains: ReadonlySet<string>;
    readonly defectClasses: ReadonlySet<string>;
  },
): void {
  const seen = new Set<string>();
  for (const item of brief.items) {
    if ((!domains.has(item.anchorDomain,)) || (!defectClasses.has(item.defectClass,)))
      throw new Error('brief item exceeds specialist responsibility');
    const located = item.anchorDomain === 'source'
      ? sourceText.includes(item.anchor,)
      : item.anchorDomain === 'archive'
        ? archiveText.includes(item.anchor,)
        : mediaNames.has(item.anchor,);
    if (!located)
      throw new Error('brief item anchor is not located');
    const identity = JSON.stringify(item,);
    if (seen.has(identity,))
      throw new Error('brief repeats identical item');
    seen.add(identity,);
  }
}

export function buildEditorialPacket(
  {
    sourceText,
    archiveText,
    mediaNames,
    briefs,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly mediaNames: readonly string[];
    readonly briefs: ReadonlyMap<string, PreparationBrief>;
  },
): EditorialPacket {
  const items = BRIEF_NODES.flatMap(function itemsFor(node,) {
    const brief = briefs.get(node.id,);
    if (brief === undefined)
      return [];
    return brief.items.map(function locate(item, index,): LocatedBriefItem {
      return {
        briefId: `${node.id}/${String(index,)}`,
        authorNodeId: node.id,
        ...item,
      };
    },);
  },);
  return {
    sourceUnits: sourceUnitsFor({ sourceText, }),
    lockedContributorForms: archiveContributorNameForms({ text: archiveText, }),
    mediaNames,
    missingBriefNodes: BRIEF_NODES.filter(function missing(node,) {
      return !briefs.has(node.id,);
    },).map(function id(node,) { return node.id; },),
    items,
  };
}

export function editorSystemInstruction(): string {
  return 'You are the sole accountable whole-document editor. Produce one complete publication-ready English document from SOURCE, ARCHIVE EVIDENCE, and EDITORIAL PACKET. Own correct meaning, every source proposition, no unsupported addition, identities, attribution, grammar, usage, references, tense, chronology, paragraph relations, register, structure, front matter, links, media-derived content, image references, formatting, and footnotes. Preserve every locked contributor form exactly. Preserve sound archive wording where possible. Return no alternatives, score, approval, or finding-only report. Realizations must contain every source unit id exactly once and quote exact nonempty text from document showing where unit is carried. Brief dispositions must contain every brief id exactly once. A not-applicable disposition requires concrete reason. Missing briefs are nonblocking and do not reduce your full responsibility.';
}

export function editorUserInstruction(
  {
    sourceText,
    archiveText,
    packet,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly packet: EditorialPacket;
  },
): string {
  return `SOURCE:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nEDITORIAL PACKET:\n${JSON.stringify(packet,)}`;
}

function exactIdSet(
  {
    expected,
    actual,
    label,
  }: {
    readonly expected: readonly string[];
    readonly actual: readonly string[];
    readonly label: string;
  },
): void {
  if ((new Set(actual,).size !== actual.length)
    || (actual.length !== expected.length)
    || expected.some(function absent(id,) { return !actual.includes(id,); }))
    throw new Error(`${label} ids differ from manifest`);
}

export function validateBriefEditorCandidate(
  {
    response,
    packet,
    sourceText,
    archiveText,
    sourcePictures,
  }: {
    readonly response: BriefEditorDocument;
    readonly packet: EditorialPacket;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourcePictures: readonly { readonly assetName: string; }[];
  },
): void {
  exactIdSet({
    expected: packet.sourceUnits.map(function id(unit,) { return unit.id; },),
    actual: response.realizations.map(function id(realization,) { return realization.sourceUnitId; },),
    label: 'source realization',
  },);
  if (response.realizations.some(function missing(realization,) {
    return !response.document.includes(realization.targetQuote,);
  },))
    throw new Error('source realization target quote absent from document');
  exactIdSet({
    expected: packet.items.map(function id(item,) { return item.briefId; },),
    actual: response.briefDispositions.map(function id(disposition,) { return disposition.briefId; },),
    label: 'brief disposition',
  },);
  validateSerialCandidate({
    sourceText,
    archiveText,
    sourcePictures,
    candidate: response.document,
  },);
}

export function selectFixedPriorityEditor<ValueT,>(
  { usable, }: { readonly usable: ReadonlyMap<string, ValueT>; },
): { readonly id: string; readonly value: ValueT; } | undefined {
  const selected = EDITOR_NODES
    .toSorted(function byPriority(left, right,) { return left.priority - right.priority; },)
    .find(function first(node,) { return usable.has(node.id,); },);
  if (selected === undefined)
    return undefined;
  const value = usable.get(selected.id,);
  if (value === undefined)
    throw new Error('fixed-priority selection lost selected value');
  return { id: selected.id, value, };
}
