// PROTOTYPE ONLY: Candidate I AST-derived target-language syntax separators.

import type {
  Nodes,
  Root,
} from 'mdast';

import type { DeepReadonlyData, } from './readonly-data.ts';
import type { ImmutableShell, } from './prototype-slot-model.ts';
import {
  MdxParseError,
  parseMarkdownBody,
  parseMdxBody,
} from './parse-mdx.ts';

/**
 * AST-derived relation between model text and locked inline syntax.
 */
export type CandidateTargetBoundary = {
  /**
   * Slot receiving runtime separator.
   */
  readonly slotKey: string;
  /**
   * Slot edge touching locked syntax.
   */
  readonly edge: 'before' | 'after';
  /**
   * Locked syntax role from parsed sibling node.
   */
  readonly syntaxRole:
    | 'code'
    | 'expression'
    | 'footnote'
    | 'formatting'
    | 'html'
    | 'link'
    | 'media';
};

/**
 * Candidate-specific resolved relation after reading sanitized target text.
 */
export type ResolvedCandidateTargetBoundary = CandidateTargetBoundary & {
  /**
   * Exact separator inserted outside model authority.
   */
  readonly separator: '' | ' ';
};

/**
 * Post-boundary candidate compilation.
 */
export type CandidateBallotCompilation = {
  /**
   * Complete publication candidate.
   */
  readonly document: string;
  /**
   * Runtime-owned compiled slot segments used by target anchors.
   */
  readonly slots: Readonly<Record<string, string>>;
  /**
   * Candidate-specific exact separator decisions.
   */
  readonly resolvedBoundaries: readonly ResolvedCandidateTargetBoundary[];
};

/**
 * Deeply readonly parsed node accepted by pure boundary traversal.
 */
type ReadonlyNode = DeepReadonlyData<Nodes>;

/**
 * Deeply readonly parsed root accepted by pure boundary traversal.
 */
type ReadonlyRoot = DeepReadonlyData<Root>;

/**
 * Deeply readonly parsed parent with typed child sequence.
 */
type ReadonlyParentNode = ReadonlyNode & {
  readonly children: readonly ReadonlyNode[];
};

/**
 * Sentinel for node without locked syntax role.
 */
const NO_TARGET_BOUNDARY: unique symbol = Symbol('target syntax boundary absent',);

/**
 * Returns required UTF-16 offset from parsed node.
 *
 * @returns Required source offset
 */
function requiredOffset({
  node,
  edge,
}: {
  readonly node: ReadonlyNode;
  readonly edge: 'start' | 'end';
}): number {
  /**
   * Parsed source offset.
   */
  const offset = node.position?.[edge]
    .offset;
  if (offset === undefined)
    throw new Error(`candidate target boundary ${node.type} ${edge} offset is absent`);
  return offset;
}

/**
 * Maps parsed sibling node to locked syntax role.
 *
 * @param node - Parsed sibling node
 *
 * @returns Locked syntax role or absent sentinel
 */
function syntaxRole(
  node: ReadonlyNode,
): CandidateTargetBoundary['syntaxRole'] | typeof NO_TARGET_BOUNDARY {
  if ((node.type === 'link') || (node.type === 'linkReference'))
    return 'link';
  if (node.type === 'footnoteReference')
    return 'footnote';
  if (node.type === 'inlineCode')
    return 'code';
  if ((node.type === 'strong')
    || (node.type === 'emphasis')
    || (node.type === 'delete'))
    return 'formatting';
  if (node.type === 'mdxTextExpression')
    return 'expression';
  if ((node.type === 'html')
    || node.type
    .startsWith('mdxJsxText'))
    return 'html';
  if ((node.type === 'image') || (node.type === 'imageReference'))
    return 'media';
  return NO_TARGET_BOUNDARY;
}

/**
 * Parses shell body through same MDX-first fallback used by shell builder.
 *
 * @returns Parsed readonly root
 */
function parseBoundaryRoot({ body, }: { readonly body: string }): ReadonlyRoot {
  try {
    return parseMdxBody({ body, });
  }
  catch (error) {
    if (!(error instanceof MdxParseError))
      throw error;
    return parseMarkdownBody({ body, });
  }
}

/**
 * Whether parsed node carries readonly child sequence.
 *
 * @param node - Parsed node
 *
 * @returns Whether node is parent
 */
function isParentNode(node: ReadonlyNode,): node is ReadonlyParentNode {
  return ('children' in node) && Array.isArray(node.children,);
}

/**
 * Collects relations from adjacent parsed siblings recursively.
 *
 * @returns Relations within node descendants
 */
function boundariesInNode({
  node,
  shell,
}: {
  readonly node: ReadonlyNode;
  readonly shell: ImmutableShell;
}): readonly CandidateTargetBoundary[] {
  if (!isParentNode(node,))
    return [];
  /**
   * Relations owned by text children at current AST level.
   */
  const current = node.children
    .flatMap(function childBoundary(
      child,
      index,
    ) {
    if (child.type !== 'text')
      return [];
    /**
     * Exact shell slot represented by parsed text node.
     */
    const slot = shell.slots
      .find(function exact(candidate,) {
      return (candidate.kind === 'text')
        && (candidate.startOffset === requiredOffset({
          node: child,
          edge: 'start',
        }))
        && (candidate.endOffset === requiredOffset({
          node: child,
          edge: 'end',
        }));
    },);
    if (slot === undefined)
      return [];
    /**
     * Parsed sibling before current text node.
     */
    const previous = node.children[index - 1];
    /**
     * Parsed sibling after current text node.
     */
    const next = node.children[index + 1];
    /**
     * Locked role ending exactly at slot start.
     */
    const beforeRole = (previous !== undefined)
      && (requiredOffset({
        node: previous,
        edge: 'end',
      }) === slot.startOffset)
      ? syntaxRole(previous,)
      : NO_TARGET_BOUNDARY;
    /**
     * Locked role starting exactly at slot end.
     */
    const afterRole = (next !== undefined)
      && (requiredOffset({
        node: next,
        edge: 'start',
      }) === slot.endOffset)
      ? syntaxRole(next,)
      : NO_TARGET_BOUNDARY;
    return [
      ...((typeof beforeRole) === 'symbol' ? [] : [{
        slotKey: slot.key,
        edge: 'before' as const,
        syntaxRole: beforeRole,
      },]),
      ...((typeof afterRole) === 'symbol' ? [] : [{
        slotKey: slot.key,
        edge: 'after' as const,
        syntaxRole: afterRole,
      },]),
    ];
  },);
  /**
   * Relations nested below current AST node.
   */
  const nested = node.children
    .flatMap(function descendants(child,) {
    return boundariesInNode({
      node: child,
      shell,
    });
  },);
  return [
    ...current,
    ...nested,
  ];
}

/**
 * Derives every target-text relation adjacent to locked inline syntax.
 *
 * @returns Canonical AST-derived relations in source order
 *
 * @example
 * ```ts
 * const boundaries = targetBoundariesForShell({ shell, });
 * ```
 */
export function targetBoundariesForShell({
  shell,
}: {
  readonly shell: ImmutableShell;
}): readonly CandidateTargetBoundary[] {
  return boundariesInNode({
    node: parseBoundaryRoot({ body: shell.body, }),
    shell,
  },);
}

/**
 * Refuses boundary substitution or stale shell relation.
 *
 * @example
 * ```ts
 * assertTargetBoundariesBindShell({ shell, boundaries, });
 * ```
 */
export function assertTargetBoundariesBindShell({
  shell,
  boundaries,
}: {
  readonly shell: ImmutableShell;
  readonly boundaries: readonly CandidateTargetBoundary[];
}): void {
  /**
   * Canonical relations recomputed from immutable shell.
   */
  const expected = targetBoundariesForShell({ shell, });
  if (JSON.stringify(boundaries,) !== JSON.stringify(expected,))
    throw new Error('immutable target boundary manifest differs');
}
