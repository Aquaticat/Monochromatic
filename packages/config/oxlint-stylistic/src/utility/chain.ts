import type { Span, } from '@oxlint/plugins';

import { hasParens, } from './has-parens.ts';

/**
 * Boundary position within a chained expression where the autofix should
 * insert `\n + indent` to break before the boundary token.
 */
export type Boundary = {
  /** Byte offset of the first character of the boundary token in source. */
  readonly offset: number;
  /**
   * Whether the inter-segment slice contains only safely-replaceable filler
   * (whitespace plus, for `CallExpression`, the call's own type arguments).
   *
   * `false` means a comment, a TS non-null assertion, or other foreign content
   * sits between the segments; the rule still reports but suppresses the fix.
   */
  readonly canFix: boolean;
};

/**
 * Narrowed parent link surfaced on any AST node by oxlint's visitor walker.
 *
 * Used by the root predicates to consult fields beyond the base `Span` shape
 * without committing to a node-specific interface at every call site.
 */
type ParentLike = Span & {
  /** AST node type discriminant. */
  readonly type?: string;
  /** Same-type chain operator for `BinaryExpression` and `LogicalExpression`. */
  readonly operator?: string;
  /** `MemberExpression.object` for chain continuation checks. */
  readonly object?: Span;
  /** `CallExpression.callee` for chain continuation checks. */
  readonly callee?: Span;
};

/**
 * Binary or logical operand carrying the `operator` field used to detect
 * same-operator chains.
 */
export type BinaryLikeNode = Span & {
  /** AST node type discriminant. */
  readonly type: string;
  /** Operator literal used to match against the parent's operator. */
  readonly operator: string;
  /** Left operand carrying the optional type/operator fields used to continue walking. */
  readonly left: Span & {
    /** Node type, if exposed; used to detect chain continuation. */
    readonly type?: string;
    /** Operator literal, if exposed; used to detect chain continuation. */
    readonly operator?: string;
  };
  /** Right operand; walked when collecting chain segments. */
  readonly right: Span;
  /** Parent link surfaced by the visitor walker. */
  readonly parent?: ParentLike;
};

/**
 * Member or call frame carrying the punctuator-relevant fields used to find
 * boundary offsets.
 */
export type MemberOrCallNode = Span & {
  /** Either `'MemberExpression'` or `'CallExpression'`. */
  readonly type: 'CallExpression' | 'MemberExpression';
  /** True for optional `?.` access; controls the boundary token shape. */
  readonly optional: boolean;
  /** Computed-property flag for `MemberExpression`. */
  readonly computed?: boolean;
  /** Object being accessed in a `MemberExpression`. */
  readonly object?: Span;
  /** Callee being invoked in a `CallExpression`. */
  readonly callee?: Span;
  /** TypeScript type arguments range, if present on a `CallExpression`. */
  readonly typeArguments?: Span | null;
  /** Parent link surfaced by the visitor walker. */
  readonly parent?: ParentLike;
};

/**
 * Parameters for {@link isBinaryChainRoot}.
 */
export type IsBinaryChainRootParams = {
  /** Candidate root node. */
  readonly node: BinaryLikeNode;
  /** Full file source text; used to detect paren-isolated subtrees. */
  readonly sourceText: string;
};

/**
 * Determines whether a `BinaryExpression` or `LogicalExpression` is the top
 * of its same-operator chain.
 *
 * The chain is defined by same node type and same operator; precedence is
 * already enforced by `no-mixed-operators`, which wraps mixed-operator
 * children in parentheses. Source-level parens around this node isolate it
 * from any same-operator parent, so a parenthesised node always counts as a
 * root regardless of parent shape.
 *
 * @returns whether the parent breaks the chain (so `node` is the root)
 *
 * @example
 * ```ts
 * // For (a + b + c): outer BinaryExpression returns true; inner returns false
 * isBinaryChainRoot({ node, sourceText, });
 * ```
 */
export function isBinaryChainRoot({
  node,
  sourceText,
}: IsBinaryChainRootParams,): boolean {
  /** Parent link; absent at program scope, which still counts as root. */
  const { parent, } = node;
  if (parent === undefined)
    return true;
  if (parent.type !== node.type)
    return true;
  if (parent.operator !== node.operator)
    return true;
  if (hasParens({
    child: node,
    sourceText,
  },)) {
    return true;
  }
  return false;
}

/**
 * Parameters for {@link isMemberOrCallChainRoot}.
 */
export type IsMemberOrCallChainRootParams = {
  /** Candidate root node. */
  readonly node: MemberOrCallNode;
  /** Full file source text; used to detect paren-isolated subtrees. */
  readonly sourceText: string;
};

/**
 * Determines whether a `MemberExpression` or `CallExpression` is the top of
 * its member/call chain.
 *
 * Continuation links: a chain continues when this node sits as `object` of a
 * parent `MemberExpression` or as `callee` of a parent `CallExpression`.
 * `ChainExpression` (oxlint's `?.` wrapper) and `ParenthesizedExpression`
 * never match either continuation link, so the chain terminates naturally at
 * them. Source-level parens around this node also isolate it from any chain
 * continuation parent.
 *
 * @returns whether the parent breaks the chain (so `node` is the root)
 *
 * @example
 * ```ts
 * // For `a.b.c.d`: outermost MemberExpression returns true; inner returns false
 * isMemberOrCallChainRoot({ node, sourceText, });
 * ```
 */
export function isMemberOrCallChainRoot({
  node,
  sourceText,
}: IsMemberOrCallChainRootParams,): boolean {
  /** Parent link; absent at program scope, which still counts as root. */
  const { parent, } = node;
  if (parent === undefined)
    return true;
  /** Whether the parent's continuation link points to this node. */
  const isContinuationParent = ((parent.type === 'MemberExpression')
    && (parent.object === node))
    || ((parent.type === 'CallExpression')
      && (parent.callee === node));
  if (!isContinuationParent)
    return true;
  if (hasParens({
    child: node,
    sourceText,
  },)) {
    return true;
  }
  return false;
}

/**
 * Parameters for {@link collectBinaryChainOperands}.
 */
export type CollectBinaryChainOperandsParams = {
  /** Chain root identified by {@link isBinaryChainRoot}. */
  readonly root: BinaryLikeNode;
  /** Full file source text; used to detect paren-isolated subtrees. */
  readonly sourceText: string;
};

/**
 * Walks the same-operator binary/logical chain and returns the leaves in
 * source order.
 *
 * Uses in-order traversal so both left-associative chains (`a + b + c`, tree
 * `((a+b)+c)`) and right-associative chains (`a ** b ** c`, tree
 * `(a**(b**c))`) yield leaves in left-to-right source order. A subtree counts
 * as a continuation only when it shares the root's type, shares the root's
 * operator, and is not isolated by source-level parens; otherwise it is
 * treated as an opaque leaf.
 *
 * @returns operands in source order (leftmost first)
 *
 * @example
 * ```ts
 * // For `a + b + c`: returns [a, b, c]
 * collectBinaryChainOperands({ root, sourceText, });
 * ```
 */
export function collectBinaryChainOperands({
  root,
  sourceText,
}: CollectBinaryChainOperandsParams,): readonly Span[] {
  /** Accumulator collected in source order via in-order walk of continuation subtrees. */
  const leaves: Span[] = [];

  /**
   * Recursive in-order walk: descends into continuation subtrees, otherwise
   * records the node as a leaf.
   *
   * @param node - candidate operand
   */
  function walkLeaves(node: Span,): void {
    /** Operand narrowed to the operator-bearing shape for the continuation test. */
    const candidate = node as Span & {
      readonly type?: string;
      readonly operator?: string;
    };
    /** Whether the operand continues the same-operator chain and has no isolating parens. */
    const continues = (candidate.type === root.type)
      && (candidate.operator === root.operator)
      && (!hasParens({
        child: node,
        sourceText,
      },));
    if (continues) {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- continuation predicate guarantees Binary-like shape with left/right operands */
      /** Continuation subtree narrowed; both branches recurse to expose deeper leaves. */
      const bin = node as BinaryLikeNode;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      walkLeaves(bin.left,);
      walkLeaves(bin.right,);
      return;
    }
    leaves.push(node,);
  }

  walkLeaves(root.left,);
  walkLeaves(root.right,);
  return leaves;
}

/**
 * Frame in a member/call chain together with its `leftSibling` (the node
 * immediately preceding it in source order). The leaf segment is not a frame
 * and never appears in the frame list; the very first frame's `leftSibling`
 * is the chain's leaf.
 */
export type MemberOrCallFrame = {
  /** The `MemberExpression` or `CallExpression` node introducing this frame. */
  readonly node: MemberOrCallNode;
  /** Node that ends immediately before this frame's boundary in source. */
  readonly leftSibling: Span;
};

/**
 * Parameters for {@link collectMemberOrCallChainFrames}.
 */
export type CollectMemberOrCallChainFramesParams = {
  /** Chain root identified by {@link isMemberOrCallChainRoot}. */
  readonly root: MemberOrCallNode;
  /** Full file source text; used to detect paren-isolated subtrees. */
  readonly sourceText: string;
};

/**
 * Walks down `object` / `callee` links and returns the chain's frames in
 * source order, each paired with its left sibling.
 *
 * The walk stops at any left descendant that is parenthesised or of a node
 * kind other than `MemberExpression` / `CallExpression`.
 *
 * @returns frames in source order; leaf appears as the first frame's left sibling
 *
 * @example
 * ```ts
 * // For `a.b().c`: returns frames [(a.b), (().c)], with leftSibling chain `a → a.b → a.b()`
 * collectMemberOrCallChainFrames({ root, sourceText, });
 * ```
 */
export function collectMemberOrCallChainFrames({
  root,
  sourceText,
}: CollectMemberOrCallChainFramesParams,): readonly MemberOrCallFrame[] {
  /** Reverse-order accumulator: outermost frame first, innermost last. */
  const reversedNodes: MemberOrCallNode[] = [];

  /**
   * Recursive descent that follows `object` for `MemberExpression` and
   * `callee` for `CallExpression`, stopping at any other node kind or at a
   * parens-isolated subtree.
   *
   * @param current - current chain frame
   */
  function walk(current: MemberOrCallNode,): void {
    reversedNodes.push(current,);
    /** Left descendant: `object` for member access, `callee` for calls. */
    const left = (current.type === 'MemberExpression')
      ? current.object
      : current.callee;
    if (left === undefined)
      return;
    /** Type tag captured via a narrow cast; only used to decide whether to recurse. */
    const leftType = (left as Span & { readonly type?: string; }).type;
    /** Whether the descendant continues the chain by kind and is not paren-isolated. */
    const continues = ((leftType === 'MemberExpression')
      || (leftType === 'CallExpression'))
      && (!hasParens({
        child: left,
        sourceText,
      },));
    if (continues) {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- continuation predicate guarantees Member/Call shape with object/callee */
      walk(left as MemberOrCallNode,);
      /* oxlint-enable typescript/no-unsafe-type-assertion */
    }
  }

  walk(root,);
  /** Frames in source order: leaf-adjacent first, root last. */
  const sourceOrder = reversedNodes.toReversed();

  return sourceOrder.map(function pairWithLeftSibling(
    frame,
    index,
  ): MemberOrCallFrame {
    if (index === 0) {
      /** Innermost frame's left sibling: its own `object` or `callee` (the leaf). */
      const leaf = (frame.type === 'MemberExpression')
        ? frame.object
        : frame.callee;
      if (leaf === undefined)
        throw new Error('chain frame missing object/callee',);
      return {
        node: frame,
        leftSibling: leaf,
      };
    }
    /** Preceding frame's node serves as this frame's left sibling. */
    const prev = sourceOrder[index - 1];
    if (prev === undefined)
      throw new Error('chain frame missing previous frame',);
    return {
      node: frame,
      leftSibling: prev,
    };
  },);
}

/**
 * Parameters for {@link effectiveEnd}.
 */
export type EffectiveEndParams = {
  /** AST node whose source-effective end is wanted. */
  readonly node: Span;
  /** Full file source text. */
  readonly sourceText: string;
};

/**
 * Returns the byte offset immediately after the node's source-text region,
 * including a trailing `)` when the node is wrapped in source-level parens.
 *
 * oxlint strips surrounding parens from a node's `start`/`end` range, so a
 * paren-wrapped operand like `(b + c)` reports `end` at the inner content's
 * end rather than after the `)`. Boundary scanning relies on a left sibling
 * whose end sits past any closing punctuation; otherwise the inter-segment
 * slice contains the `)` and the cleanliness check rejects an otherwise-safe
 * fix. Tolerates whitespace between the inner content and the `)`.
 *
 * @returns end offset including the trailing `)` if present, else `node.end`
 *
 * @example
 * ```ts
 * // For source `(b + c) + d`, with node = BinaryExpression `b + c`:
 * effectiveEnd({ node, sourceText, }); // node.end + 1 (past the `)`)
 * ```
 */
export function effectiveEnd({
  node,
  sourceText,
}: EffectiveEndParams,): number {
  if (!hasParens({
    child: node,
    sourceText,
  },)) {
    return node.end;
  }
  /**
   * Recursive scan that advances past whitespace from `node.end` until the
   * closing paren character.
   *
   * @param idx - cursor position
   *
   * @returns position of the `)` byte, or `-1` if absent
   */
  function findClose(idx: number,): number {
    if (idx >= sourceText.length)
      return -1;
    /** Current character; tolerates whitespace between the inner span and the closing paren. */
    const c = sourceText.charAt(idx,);
    if (c === ')')
      return idx;
    /** Whether the current character is whitespace and the scan can continue. */
    const isWs = (c === ' ')
      || (c === '\t')
      || (c === '\n')
      || (c === '\r')
      || (c === '\f')
      || (c === '\v');
    if (!isWs)
      return -1;
    return findClose(idx + 1,);
  }
  /** Position of the closing paren, or -1 when the scan failed. */
  const closeIdx = findClose(node.end,);
  if (closeIdx === (-1))
    return node.end;
  return closeIdx + 1;
}

/**
 * Returns the source-text token shape introduced at this frame's boundary.
 *
 * Each shape is the literal characters that must appear, in order, somewhere
 * in `sourceText.slice(leftSibling.end, ...)` for the boundary scanner to
 * locate the break point.
 *
 * @param frame - chain frame
 *
 * @returns boundary token string
 *
 * @example
 * ```ts
 * // For `a?.b`: returns '?.'
 * // For `a.b`:  returns '.'
 * // For `a[b]`: returns '['
 * // For `a()`:  returns '('
 * memberOrCallBoundaryToken(frame);
 * ```
 */
export function memberOrCallBoundaryToken(frame: MemberOrCallFrame,): string {
  /** Frame node carries the `optional` / `computed` flags used here. */
  const { node, } = frame;
  if (node.optional)
    return '?.';
  if (node.type === 'CallExpression')
    return '(';
  if (node.computed === true)
    return '[';
  return '.';
}

/**
 * Parameters for {@link findBoundaryOffset}.
 */
export type FindBoundaryOffsetParams = {
  /** Full file source text. */
  readonly sourceText: string;
  /** Byte offset to begin the scan at; typically the left sibling's effective end. */
  readonly from: number;
  /** Boundary token literal to scan for. */
  readonly token: string;
};

/**
 * Locates the byte offset where the boundary token begins, scanning forward
 * from `from`.
 *
 * The first occurrence of `token` at or after `from` is the answer for every
 * chain shape this rule supports because chain boundaries always sit between
 * the two child node ranges, with only whitespace, TS type arguments, or
 * comments allowed between them.
 *
 * @returns boundary offset, or `-1` if the token is not found
 *
 * @example
 * ```ts
 * // For source `a + b`, with from = 1 (after `a`), token = '+': returns 2
 * findBoundaryOffset({ sourceText, from, token, });
 * ```
 */
export function findBoundaryOffset({
  sourceText,
  from,
  token,
}: FindBoundaryOffsetParams,): number {
  return sourceText.indexOf(
    token,
    from,
  );
}

/**
 * Parameters for {@link isInterSegmentClean}.
 */
export type IsInterSegmentCleanParams = {
  /** Full file source text. */
  readonly sourceText: string;
  /** Byte offset where the inter-segment slice begins; the left sibling's effective end. */
  readonly from: number;
  /** Byte offset of the boundary token's first character. */
  readonly boundaryOffset: number;
  /** Type-arguments range from a `CallExpression`, if any. */
  readonly typeArguments?: Span | null | undefined;
};

/**
 * Returns true when the source slice between `from` and `boundaryOffset`
 * contains only autofix-safe filler: whitespace, and when a `CallExpression`'s
 * type arguments occupy that slice, exactly the range
 * `[typeArguments.start, typeArguments.end)`.
 *
 * A comment, semicolon, TS non-null assertion, or any other content in that
 * slice fails the check; the rule still reports the violation but suppresses
 * the fix to avoid clobbering writer intent.
 *
 * @returns whether the autofix may be emitted for this boundary
 *
 * @example
 * ```ts
 * // For source `a + b`, with from = 1, boundaryOffset = 2: returns true (only ' ')
 * isInterSegmentClean({ sourceText, from, boundaryOffset, });
 * ```
 */
export function isInterSegmentClean({
  sourceText,
  from,
  boundaryOffset,
  typeArguments,
}: IsInterSegmentCleanParams,): boolean {
  /** Whether type arguments are present and define a permitted non-whitespace slice. */
  const hasTypeArgs = (typeArguments !== undefined) && (typeArguments !== null);
  /** Start of the type-args range, or `from` when no type args exist. */
  const taStart = hasTypeArgs ? typeArguments.start : from;
  /** End of the type-args range; equals `taStart` when no type args exist. */
  const taEnd = hasTypeArgs ? typeArguments.end : from;

  /**
   * Recursive whitespace scan over `[lo, hi)`.
   *
   * @param lo - inclusive lower bound
   *
   * @param hi - exclusive upper bound
   *
   * @returns whether every character in the half-open range is whitespace
   */
  function scan({
    lo,
    hi,
  }: {
    readonly lo: number;
    readonly hi: number;
  },): boolean {
    if (lo >= hi)
      return true;
    /** Current character; tested against the ASCII whitespace set used elsewhere. */
    const c = sourceText.charAt(lo,);
    /** Whether the current character is allowable filler. */
    const ok = (c === ' ')
      || (c === '\t')
      || (c === '\n')
      || (c === '\r')
      || (c === '\f')
      || (c === '\v');
    if (!ok)
      return false;
    return scan({
      lo: lo + 1,
      hi,
    },);
  }

  if (!scan({
    lo: from,
    hi: taStart,
  },)) {
    return false;
  }
  return scan({
    lo: taEnd,
    hi: boundaryOffset,
  },);
}
