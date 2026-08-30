// PROTOTYPE ONLY: Candidate D immutable shell and fixed-key slot compilation.

import type { Nodes, Root, } from 'mdast';

import { CONTRIBUTOR_LABELS, } from './contributor-name-authority.ts';
import { hashContent, } from './document-node.ts';
import { splitFrontMatter, } from './front-matter.ts';
import {
  MdxParseError,
  parseMarkdownBody,
  parseMdxBody,
} from './parse-mdx.ts';
import { parseDocument, } from './parse-document.ts';
import { compileSlotBody, } from './prototype-slot-compile.ts';
import { assertSourceLeafCoverage, } from './prototype-slot-coverage.ts';
import type { ImmutableShell, ImmutableSlot, } from './prototype-slot-model.ts';

type PositionedNode = Nodes & {
  readonly children?: readonly Nodes[];
};

type UnkeyedSlot = Omit<ImmutableSlot, 'key'>;

type ImmutableRange = {
  readonly startOffset: number;
  readonly endOffset: number;
};

type BodyAuthority = {
  readonly body: string;
  readonly lockedRanges: readonly ImmutableRange[];
};

function requiredOffset(
  {
    node,
    edge,
  }: {
    readonly node: PositionedNode;
    readonly edge: 'start' | 'end';
  },
): number {
  const offset = node.position?.[edge].offset;
  if (offset === undefined)
    throw new Error(`immutable shell ${node.type} ${edge} offset is absent`);
  return offset;
}

function imageAltSpan(
  {
    node,
    body,
    parentKind,
  }: {
    readonly node: PositionedNode;
    readonly body: string;
    readonly parentKind: string;
  },
): UnkeyedSlot | undefined {
  const nodeStart = requiredOffset({ node, edge: 'start', });
  const nodeEnd = requiredOffset({ node, edge: 'end', });
  const opener = body.indexOf('![', nodeStart,);
  if ((opener < nodeStart) || (opener >= nodeEnd))
    throw new Error('immutable shell image opener is absent');
  const altStart = opener + 2;
  let cursor = altStart;
  let escaped = false;
  while (cursor < nodeEnd) {
    const character = body[cursor];
    if (character === undefined)
      break;
    if (escaped)
      escaped = false;
    else if (character === '\\')
      escaped = true;
    else if (character === ']') {
      if (cursor === altStart)
        return undefined;
      return {
        kind: 'image-alt',
        parentKind,
        source: body.slice(altStart, cursor,),
        startOffset: altStart,
        endOffset: cursor,
      };
    }
    cursor += 1;
  }
  throw new Error('immutable shell image alt closer is absent');
}

function slotsInNode(
  {
    node,
    body,
    parentKind,
    lockedRanges,
  }: {
    readonly node: PositionedNode;
    readonly body: string;
    readonly parentKind: string;
    readonly lockedRanges: readonly ImmutableRange[];
  },
): readonly UnkeyedSlot[] {
  if (node.type === 'text') {
    const startOffset = requiredOffset({ node, edge: 'start', });
    const endOffset = requiredOffset({ node, edge: 'end', });
    const source = body.slice(startOffset, endOffset,);
    const locked = lockedRanges.some(function covers(range,) {
      return (startOffset >= range.startOffset) && (endOffset <= range.endOffset);
    },);
    if (locked || (source.trim() === ''))
      return [];
    return [{
      kind: 'text',
      parentKind,
      source,
      startOffset,
      endOffset,
    },];
  }
  if ((node.type === 'image') || (node.type === 'imageReference')) {
    const slot = imageAltSpan({ node, body, parentKind, });
    const locked = slot !== undefined && lockedRanges.some(function covers(range,) {
      return (slot.startOffset >= range.startOffset) && (slot.endOffset <= range.endOffset);
    },);
    return (slot === undefined) || locked ? [] : [slot,];
  }
  if (!Array.isArray(node.children,))
    return [];
  return node.children.flatMap(function childSlots(child,): readonly UnkeyedSlot[] {
    return slotsInNode({
      node: child as PositionedNode,
      body,
      parentKind: node.type,
      lockedRanges,
    },);
  },);
}

function parseShellRoot({ body, }: { readonly body: string; }): Root {
  try {
    return parseMdxBody({ body, },);
  }
  catch (error) {
    if (!(error instanceof MdxParseError))
      throw error;
    return parseMarkdownBody({ body, },);
  }
}

function slotValuesFromSource(
  { slots, }: { readonly slots: readonly ImmutableSlot[]; },
): Readonly<Record<string, string>> {
  return Object.fromEntries(slots.map(function pair(slot,): readonly [string, string] {
    return [slot.key, slot.source,];
  },),);
}

function bodyWithContributorAuthority(
  {
    sourceText,
    archiveText,
    sourceBody,
    sourceBodyOffset,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
    readonly sourceBody: string;
    readonly sourceBodyOffset: number;
  },
): BodyAuthority {
  const sourceNodes = parseDocument({ text: sourceText, }).nodes;
  const archiveNodes = parseDocument({ text: archiveText, }).nodes;
  const replacements = archiveNodes.flatMap(function authority(archiveNode, index,) {
    const carriesAuthority = CONTRIBUTOR_LABELS.some(function begins(label,) {
      return archiveNode.text.startsWith(label,);
    },);
    if (!carriesAuthority)
      return [];
    const distanceFromEnd = archiveNodes.length - index;
    const sourceNode = sourceNodes[sourceNodes.length - distanceFromEnd];
    if (sourceNode === undefined)
      throw new Error('immutable shell contributor authority has no source node');
    return [{
      startOffset: sourceNode.startOffset - sourceBodyOffset,
      endOffset: sourceNode.endOffset - sourceBodyOffset,
      text: archiveNode.text,
    },];
  },).toSorted(function byStart(left, right,) { return left.startOffset - right.startOffset; },);
  const transformed = replacements.reduce(function locate(
    state,
    replacement,
  ): { readonly delta: number; readonly ranges: readonly ImmutableRange[]; } {
    const startOffset = replacement.startOffset + state.delta;
    const endOffset = startOffset + replacement.text.length;
    return {
      delta: state.delta + replacement.text.length - (replacement.endOffset - replacement.startOffset),
      ranges: [...state.ranges, { startOffset, endOffset, },],
    };
  }, { delta: 0, ranges: [] as readonly ImmutableRange[], },);
  const body = replacements.toReversed().reduce(function replace(current, replacement,) {
    return `${current.slice(0, replacement.startOffset)}${replacement.text}${current.slice(replacement.endOffset)}`;
  }, sourceBody,);
  return { body, lockedRanges: transformed.ranges, };
}

export function buildImmutableShell(
  {
    sourceText,
    archiveText,
  }: {
    readonly sourceText: string;
    readonly archiveText: string;
  },
): ImmutableShell {
  const source = splitFrontMatter({ text: sourceText, },);
  const archive = splitFrontMatter({ text: archiveText, },);
  const authority = bodyWithContributorAuthority({
    sourceText,
    archiveText,
    sourceBody: source.body,
    sourceBodyOffset: source.bodyOffset,
  },);
  const root = parseShellRoot({ body: authority.body, }) as PositionedNode;
  assertSourceLeafCoverage({ node: root, body: authority.body, });
  const unkeyed = slotsInNode({
    node: root,
    body: authority.body,
    parentKind: 'root',
    lockedRanges: authority.lockedRanges,
  },).toSorted(function byStart(left, right,) { return left.startOffset - right.startOffset; },);
  unkeyed.reduce(function nonOverlapping(previousEnd, slot,): number {
    if (slot.startOffset < previousEnd)
      throw new Error('immutable shell slots overlap');
    return slot.endOffset;
  }, 0,);
  const slots = unkeyed.map(function key(slot, index,): ImmutableSlot {
    return { key: `s${String(index,)}`, ...slot, };
  },);
  if (slots.length === 0)
    throw new Error('immutable shell has no translatable slots');
  const frontMatter = archive.frontMatter?.raw ?? source.frontMatter?.raw ?? '';
  const controlDocument = `${frontMatter}${compileSlotBody({
    body: authority.body,
    slots,
    values: slotValuesFromSource({ slots, }),
  },)}`;
  return {
    frontMatter,
    body: authority.body,
    slots,
    lockedRanges: authority.lockedRanges,
    controlDocument,
    shellDigest: hashContent({ content: JSON.stringify({
      frontMatter,
      body: authority.body,
      slots,
      lockedRanges: authority.lockedRanges,
    },), }),
  };
}
