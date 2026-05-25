import type { Context, } from '@oxlint/plugins';

import {
  type ChainNode,
  parenIsolated,
} from './chain.ts';
import type { ChainSegment, } from './chain-render.ts';

/** Shared attached-segment value: rides on the previous segment's line, never a break point. */
const ATTACHED: ChainSegment = { isBreak: false, };

/**
 * Reports whether a node type is a transparent chain wrapper.
 *
 * The walk passes through these without emitting a segment of their own; their
 * source text (`!`, `as T`, `satisfies T`, or nothing for `ChainExpression`)
 * folds into the slice of the segment before them.
 *
 * @param type - AST node-type discriminant
 *
 * @returns whether the type is `ChainExpression`, `!`, `as`, or `satisfies`
 */
function isTransparentWrapper(type: string,): boolean {
  return (type === 'ChainExpression')
    || (type === 'TSNonNullExpression')
    || (type === 'TSAsExpression')
    || (type === 'TSSatisfiesExpression');
}

/**
 * Parameters for {@link memberDotStart}.
 */
type MemberDotStartParams = {
  /** Rule context; its `sourceCode` supplies the property-preceding token lookup. */
  readonly context: Context;
  /** Non-computed `MemberExpression` whose `.`/`?.` offset is wanted. */
  readonly member: ChainNode;
};

/**
 * Returns the byte offset of a member step's `.` or `?.` token.
 *
 * The token immediately before the property name is the dot (or optional-chain)
 * punctuator; its start is where a continuation line for this step begins.
 *
 * @returns byte offset of the member step's leading dot token
 *
 * @throws when the property or its preceding token is absent, which is
 *   unreachable for a non-computed member access
 */
function memberDotStart({
  context,
  member,
}: MemberDotStartParams,): number {
  /** Accessed property; its preceding token is the dot punctuator. */
  const { property, } = member;
  if (property === undefined) {
    throw new Error('member step missing property',);
  }
  /** `.` or `?.` token immediately before the property name. */
  const dot = context.sourceCode
    .getTokenBefore(property,);
  if (dot === null) {
    throw new Error('member step missing dot token',);
  }
  return dot.start;
}

/**
 * Parameters for {@link operatorTokenStart}.
 */
type OperatorTokenStartParams = {
  /** Rule context; its `sourceCode` supplies the operator-token lookup. */
  readonly context: Context;
  /** `BinaryExpression` or `LogicalExpression` whose operator offset is wanted. */
  readonly node: ChainNode;
};

/**
 * Returns the byte offset of an operator's token.
 *
 * The first token after the left operand whose value equals the operator skips
 * any closing parenthesis of a parenthesised left operand and lands on the
 * operator itself; its start is where the operator's continuation line begins,
 * so the operator renders leading (`+ c`).
 *
 * @returns byte offset of the operator token
 *
 * @throws when the left operand, operator, or token is absent, which is
 *   unreachable for a binary or logical expression
 */
function operatorTokenStart({
  context,
  node,
}: OperatorTokenStartParams,): number {
  /** Left operand; the operator token is the first matching token after it. */
  const {
    left,
    operator,
  } = node;
  if ((left === undefined) || (operator === undefined)) {
    throw new Error('operator node missing left operand or operator',);
  }
  /** First token after the left operand whose value is the operator literal. */
  const token = context.sourceCode
    .getTokenAfter(
    left,
    {
      filter: function matchesOperator(candidate,): boolean {
        return candidate.value
          === operator;
      },
    },
  );
  if (token === null) {
    throw new Error('operator node missing operator token',);
  }
  return token.start;
}

/**
 * Parameters for the chain-walk functions keyed on a single node.
 */
type ChainWalkParams = {
  /** Rule context; its `sourceCode` supplies token lookups during the walk. */
  readonly context: Context;
  /** Node currently being walked. */
  readonly node: ChainNode;
};

/**
 * Returns the child a chain node descends into, or `undefined` for a leaf.
 *
 * Transparent wrappers descend through `.expression`; member access descends
 * through `.object`; calls descend through `.callee`. Any other node, including
 * `new` expressions and tagged templates, terminates the walk as the leaf.
 *
 * @param node - chain node whose receiver link is wanted
 *
 * @returns receiver to descend into, or `undefined` when the node is the leaf
 */
function descentChild(node: ChainNode,): ChainNode | undefined {
  if (isTransparentWrapper(node.type,))
    return node.expression;
  if (node.type
    === 'MemberExpression')
    return node.object;
  if (node.type
    === 'CallExpression')
    return node.callee;
  return undefined;
}

/**
 * Returns the segment a chain node contributes after its receiver.
 *
 * A non-computed member access is a break point carrying its dot offset; a
 * computed access (`[expr]`, `?.[expr]`) and a call are attached; a transparent
 * wrapper contributes nothing because its text rides on the prior segment.
 *
 * @returns trailing segment list (empty for transparent wrappers)
 */
function trailingStep({
  context,
  node,
}: ChainWalkParams,): ChainSegment[] {
  if (node.type
    === 'MemberExpression') {
    return (node.computed
      === true)
      ? [ATTACHED,]
      : [
        {
          isBreak: true,
          breakOffset: memberDotStart({
            context,
            member: node,
          },),
        },
      ];
  }
  if (node.type
    === 'CallExpression')
    return [ATTACHED,];
  return [];
}

/**
 * Flattens a member/call chain into segments in source order, leaf first.
 *
 * Descends the receiver spine to the leaf, treating a grouping-parenthesised
 * receiver as an opaque leaf, then appends each step's trailing segment. The
 * leaf and every attached step ride on one line until the layout rule breaks
 * them; member-name steps are the only break points this produces.
 *
 * @returns segments in source order, the leaf at index 0
 *
 * @example
 * ```ts
 * // For `a.b.c`: [leaf a, break .b, break .c]
 * chainSegmentsWithLeaf({ context, node, });
 * ```
 */
export function chainSegmentsWithLeaf({
  context,
  node,
}: ChainWalkParams,): ChainSegment[] {
  /** Receiver to descend into; absent when the node is the chain leaf. */
  const child = descentChild(node,);
  if (child === undefined) {
    return [ATTACHED,];
  }
  /** Receiver segments: an opaque leaf when grouping parens isolate the child, else its own chain. */
  const receiver = parenIsolated({
    context,
    node: child,
  },)
    ? [ATTACHED,]
    : chainSegmentsWithLeaf({
      context,
      node: child,
    },);
  return [
    ...receiver,
    ...trailingStep({
      context,
      node,
    },),
  ];
}

/**
 * One item of an operator chain in source order: an operand subchain or an
 * operator between two operands.
 */
type StreamItem =
  | {
    readonly kind: 'operand';
    /** Operand node; flattened as its own member/call subchain. */
    readonly node: ChainNode;
  }
  | {
    readonly kind: 'operator';
    /** Byte offset of the operator token; start of its continuation line. */
    readonly offset: number;
  };

/**
 * Parameters for {@link collectStream}.
 */
type CollectStreamParams = {
  /** Rule context; its `sourceCode` supplies operator-token lookups. */
  readonly context: Context;
  /** Node under consideration as a continuation or an operand. */
  readonly node: ChainNode;
  /** Root operator node type; same-type unparenthesised children continue the chain. */
  readonly rootType: string;
};

/**
 * Walks an operator chain in source order, descending both operands of every
 * same-type unparenthesised operator and emitting operands and operator tokens.
 *
 * Descending both sides flattens left- and right-associative runs alike, so
 * `a + b - c` and `a ** b ** c` each yield one operand/operator stream. A
 * grouping-parenthesised operand stops the descent and becomes one opaque
 * operand, the boundary `no-mixed-operators` already inserts for mixed
 * precedence.
 *
 * @returns operand and operator items in source order
 */
function collectStream({
  context,
  node,
  rootType,
}: CollectStreamParams,): StreamItem[] {
  /** Whether the node continues the operator chain rather than ending it as an operand. */
  const continues = (node.type
    === rootType)
    && (!parenIsolated({
      context,
      node,
    },));
  if (!continues) {
    return [
      {
        kind: 'operand',
        node,
      },
    ];
  }
  /** Operands of the continuing operator; both are descended in source order. */
  const {
    left,
    right,
  } = node;
  if ((left === undefined) || (right === undefined)) {
    throw new Error('operator chain node missing operands',);
  }
  return [
    ...collectStream({
      context,
      node: left,
      rootType,
    },),
    {
      kind: 'operator',
      offset: operatorTokenStart({
        context,
        node,
      },),
    },
    ...collectStream({
      context,
      node: right,
      rootType,
    },),
  ];
}

/**
 * Parameters for {@link buildSegmentsFromStream}.
 */
type BuildSegmentsParams = {
  /** Rule context; its `sourceCode` supplies operand subchain flattening. */
  readonly context: Context;
  /** Operand/operator stream from {@link collectStream}, root operator spliced in. */
  readonly stream: readonly StreamItem[];
};

/**
 * Converts an operator stream into chain segments.
 *
 * The leftmost operand keeps its leaf; every later operand drops it, because
 * that leaf rides on the preceding operator's line and the operator segment's
 * slice already covers it. Each operator becomes one break segment.
 *
 * @returns chain segments in source order
 */
function buildSegmentsFromStream({
  context,
  stream,
}: BuildSegmentsParams,): ChainSegment[] {
  return stream.flatMap(function build(
    item,
    index,
  ): ChainSegment[] {
    if (item.kind
      === 'operator') {
      return [
        {
          isBreak: true,
          breakOffset: item.offset,
        },
      ];
    }
    /** Operand subchain segments, leaf first. */
    const segments = chainSegmentsWithLeaf({
      context,
      node: item.node,
    },);
    return (index === 0)
      ? segments
      : segments.slice(1,);
  },);
}

/**
 * Parameters for {@link operatorSegments}.
 */
type OperatorSegmentsParams = {
  /** Rule context; its `sourceCode` supplies operator-token lookups. */
  readonly context: Context;
  /** Operator chain root (`BinaryExpression` or `LogicalExpression`). */
  readonly root: ChainNode;
};

/**
 * Flattens an operator chain root into segments in source order.
 *
 * The root always continues into its own operands, so its operator is spliced
 * between the two collected operand streams unconditionally; paren-isolation
 * only gates the operands, never the root itself.
 *
 * @returns chain segments in source order
 *
 * @throws when the root lacks operands, which is unreachable for a binary or
 *   logical expression
 */
function operatorSegments({
  context,
  root,
}: OperatorSegmentsParams,): ChainSegment[] {
  /** Root operands; the root operator sits between their collected streams. */
  const {
    left,
    right,
  } = root;
  if ((left === undefined) || (right === undefined)) {
    throw new Error('operator root missing operands',);
  }
  /** Operand/operator stream in source order with the root operator spliced in. */
  const stream: StreamItem[] = [
    ...collectStream({
      context,
      node: left,
      rootType: root.type,
    },),
    {
      kind: 'operator',
      offset: operatorTokenStart({
        context,
        node: root,
      },),
    },
    ...collectStream({
      context,
      node: right,
      rootType: root.type,
    },),
  ];
  return buildSegmentsFromStream({
    context,
    stream,
  },);
}

/**
 * Flattens any chain root into segments in source order.
 *
 * Dispatches on the root kind: operator roots flatten across their operands,
 * member and call roots flatten down their receiver spine.
 *
 * @returns chain segments in source order, the leaf at index 0
 *
 * @example
 * ```ts
 * // For `arr.map(f).filter(g)`: [leaf arr, break .map, call, break .filter, call]
 * flattenChain({ context, node, });
 * ```
 */
export function flattenChain({
  context,
  node,
}: ChainWalkParams,): ChainSegment[] {
  if ((node.type
    === 'BinaryExpression') || (node.type
      === 'LogicalExpression')) {
    return operatorSegments({
      context,
      root: node,
    },);
  }
  return chainSegmentsWithLeaf({
    context,
    node,
  },);
}
