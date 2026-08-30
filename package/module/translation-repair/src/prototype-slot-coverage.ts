// PROTOTYPE ONLY: Candidate D source-leaf completeness audit.

import type { Nodes, } from 'mdast';

type PositionedNode = Nodes & {
  readonly children?: readonly Nodes[];
};

function carriesCjkText({ text, }: { readonly text: string; }): boolean {
  return [...text,].some(function cjk(character,) {
    const codePoint = character.codePointAt(0,);
    if (codePoint === undefined)
      return false;
    return ((codePoint >= 0x3400) && (codePoint <= 0x4dbf))
      || ((codePoint >= 0x4e00) && (codePoint <= 0x9fff))
      || ((codePoint >= 0xf900) && (codePoint <= 0xfaff));
  },);
}

function requiredCoverageOffset(
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
    throw new Error(`immutable shell coverage ${node.type} ${edge} offset is absent`);
  return offset;
}

export function assertSourceLeafCoverage(
  {
    node,
    body,
  }: {
    readonly node: PositionedNode;
    readonly body: string;
  },
): void {
  if ((node.type === 'text') || (node.type === 'image') || (node.type === 'imageReference'))
    return;
  if (Array.isArray(node.children,) && (node.children.length > 0)) {
    node.children.forEach(function child(child,) {
      assertSourceLeafCoverage({ node: child as PositionedNode, body, });
    },);
    return;
  }
  const immutableKinds = new Set([
    'break',
    'code',
    'definition',
    'footnoteReference',
    'inlineCode',
    'thematicBreak',
  ],);
  if (immutableKinds.has(node.type,))
    return;
  const startOffset = requiredCoverageOffset({ node, edge: 'start', });
  const endOffset = requiredCoverageOffset({ node, edge: 'end', });
  if (carriesCjkText({ text: body.slice(startOffset, endOffset,), }))
    throw new Error(`immutable shell uncovered source language in ${node.type}`);
}
