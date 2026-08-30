// PROTOTYPE ONLY: Candidate D author roster, prompts, and fixed-priority selection.

import type { ChatMessage, ContentPart, } from '@monochromatic-dev/module-llm-type/ts';

import type { VisionMessage, } from './chat-contract.ts';
import type { PrototypeMedia, } from './prototype-brief-editor-input.ts';
import type { RosterModelId, } from './roster-id.ts';
import type {
  ImmutableShell,
  SlotDocumentResponse,
} from './prototype-slot-model.ts';

export type SlotAuthorNode = {
  readonly id: string;
  readonly modelId: RosterModelId;
  readonly priority: number;
  readonly role: string;
};

export const SLOT_AUTHOR_NODES: readonly SlotAuthorNode[] = [
  {
    id: 'primary-author',
    modelId: 'hf:moonshotai/Kimi-K3',
    priority: 0,
    role: 'priority-zero primary immutable-shell author',
  },
  {
    id: 'fallback-author',
    modelId: 'hf:Qwen/Qwen3.8-27B',
    priority: 1,
    role: 'priority-one independent fallback immutable-shell author',
  },
  {
    id: 'reserve-author',
    modelId: 'hf:zai-org/GLM-5.3-Flash',
    priority: 2,
    role: 'priority-two independent reserve immutable-shell author',
  },
];

export function slotAuthorMessages(
  {
    node,
    shell,
    sourceText,
    archiveText,
    media,
  }: {
    readonly node: SlotAuthorNode;
    readonly shell: ImmutableShell;
    readonly sourceText: string;
    readonly archiveText: string;
    readonly media: readonly PrototypeMedia[];
  },
): readonly (ChatMessage | VisionMessage)[] {
  const system = `You are ${node.role}. Produce every value of one complete English slot record. Together the slots compile into one publication-ready document. Own correct meaning, every source proposition, no unsupported addition, identity, attribution, grammar, usage, clear reference, consistent tense, chronology, paragraph relations, register, and coherent whole-page voice. Inspect every image. Preserve source-supported details and established archive wording. Each manifest key must appear exactly once. Return plain prose for that slot only: no Markdown container syntax, front matter, links, image syntax, footnote markers, alternatives, scores, approvals, audit ids, or finding-only report.`;
  const slotContract = shell.slots.map(function contract(slot,) {
    return {
      key: slot.key,
      source: slot.source,
      kind: slot.kind,
      parentKind: slot.parentKind,
    };
  },);
  const text = `SOURCE DOCUMENT:\n${sourceText}\n\nARCHIVE EVIDENCE:\n${archiveText}\n\nIMMUTABLE SHELL DIGEST:\n${shell.shellDigest}\n\nSLOT CONTRACT IN MANIFEST ORDER:\n${JSON.stringify(slotContract,)}`;
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

export function selectSlotAuthor(
  {
    usable,
  }: {
    readonly usable: ReadonlyMap<string, { readonly response: SlotDocumentResponse; readonly document: string; }>;
  },
): { readonly id: string; readonly response: SlotDocumentResponse; readonly document: string; } | undefined {
  const selected = SLOT_AUTHOR_NODES
    .toSorted(function byPriority(left, right,) { return left.priority - right.priority; },)
    .find(function present(node,) { return usable.has(node.id,); },);
  if (selected === undefined)
    return undefined;
  const value = usable.get(selected.id,);
  if (value === undefined)
    throw new Error('immutable shell selected author lost value');
  return { id: selected.id, ...value, };
}
