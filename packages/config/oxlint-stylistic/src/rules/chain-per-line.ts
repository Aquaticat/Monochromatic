import type {
  Context,
  CreateOnceRule,
  Fix,
  Fixer,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  type BinaryLikeNode,
  collectBinaryChainOperands,
  collectMemberOrCallChainFrames,
  effectiveEnd,
  findBoundaryOffset,
  isBinaryChainRoot,
  isInterSegmentClean,
  isMemberOrCallChainRoot,
  memberOrCallBoundaryToken,
  type MemberOrCallNode,
} from '../utility/chain.ts';
import { baseIndentAt, } from '../utility/indent.ts';
import { lineAt, } from '../utility/line-at.ts';

/** Minimum call-frame count that classifies a chain as a method chain worth splitting. */
const MIN_CALLS_FOR_METHOD_CHAIN = 2;

/** Minimum member-frame count that classifies a chain as deep access worth splitting. */
const MIN_MEMBERS_FOR_DEEP_ACCESS = 3;

/**
 * One boundary in a chain: the byte offset where the break should be inserted,
 * whether the slice leading up to it is safe for the autofix, and which kind
 * of chain frame introduced it.
 */
type ChainBoundary = {
  /** Byte offset of the boundary token's first character. */
  readonly offset: number;
  /** Whether the inter-segment slice contains only autofix-safe filler. */
  readonly canFix: boolean;
  /**
   * Frame kind that introduced this boundary.
   *
   * `'member'` for `MemberExpression` frames (the `.x` / `[x]` step that
   * defines "multi-step access").
   * `'call'` for `CallExpression` frames; absent for binary/logical chains
   * since they are detected by a different threshold.
   */
  readonly kind: 'binary' | 'call' | 'member';
};

/**
 * Parameters for {@link sameLineCount}.
 */
type SameLineCountParams = {
  /** Full file source text. */
  readonly sourceText: string;
  /** Ordered chain boundaries to inspect. */
  readonly boundaries: readonly ChainBoundary[];
};

/**
 * Returns the maximum number of boundaries that share any single source line.
 *
 * The chain needs splitting when at least one line carries two or more
 * boundaries; that condition is equivalent to this helper returning a value
 * greater than 1.
 *
 * @returns largest count of boundaries sitting on a single source line
 */
function sameLineCount({
  sourceText,
  boundaries,
}: SameLineCountParams,): number {
  /** Per-line buckets keyed by 1-indexed source line number; mutated by `Map.set` rather than reassigned. */
  const perLine = new Map<number, number>();
  for (const boundary of boundaries) {
    /** 1-indexed line that the boundary token begins on. */
    const line = lineAt({
      sourceText,
      offset: boundary.offset,
    },);
    perLine.set(
      line,
      (perLine.get(line,) ?? 0) + 1,
    );
  }
  /** Max over all bucket counts; spread keeps `Math.max` purely functional. */
  return Math.max(
    0,
    ...perLine.values(),
  );
}

/**
 * Parameters for {@link binaryBoundaries}.
 */
type BinaryBoundariesParams = {
  /** Chain root identified as a `BinaryExpression` or `LogicalExpression`. */
  readonly root: BinaryLikeNode;
  /** Full file source text. */
  readonly sourceText: string;
};

/**
 * Returns the chain's boundaries in source order, derived from the leaves
 * collected by {@link collectBinaryChainOperands}.
 *
 * @returns one boundary per adjacent operand pair
 */
function binaryBoundaries({
  root,
  sourceText,
}: BinaryBoundariesParams,): readonly ChainBoundary[] {
  /** Leaves in source order; one boundary lives between each adjacent pair. */
  const leaves = collectBinaryChainOperands({
    root,
    sourceText,
  },);
  /** Accumulator built once and frozen as readonly by the return signature. */
  const result: ChainBoundary[] = [];
  for (let i = 1; i < leaves.length; i++) {
    /** Previous operand; its effective end (paren-aware) anchors the boundary scan. */
    const prev = leaves[i - 1];
    if (prev === undefined)
      continue;
    /** Effective end of the previous operand, advanced past any closing paren. */
    const from = effectiveEnd({
      node: prev,
      sourceText,
    },);
    /** Byte offset of the operator token introducing this boundary. */
    const offset = findBoundaryOffset({
      sourceText,
      from,
      token: root.operator,
    },);
    if (offset === (-1))
      continue;
    /** Whether the inter-segment slice between previous-end and operator is whitespace only. */
    const canFix = isInterSegmentClean({
      sourceText,
      from,
      boundaryOffset: offset,
    },);
    result.push({
      offset,
      canFix,
      kind: 'binary',
    },);
  }
  return result;
}

/**
 * Parameters for {@link memberOrCallBoundaries}.
 */
type MemberOrCallBoundariesParams = {
  /** Chain root identified as a `MemberExpression` or `CallExpression`. */
  readonly root: MemberOrCallNode;
  /** Full file source text. */
  readonly sourceText: string;
};

/**
 * Returns the chain's boundaries in source order, derived from the frames
 * collected by {@link collectMemberOrCallChainFrames}.
 *
 * @returns one boundary per frame in the chain
 */
function memberOrCallBoundaries({
  root,
  sourceText,
}: MemberOrCallBoundariesParams,): readonly ChainBoundary[] {
  /** Frames in source order; the leaf appears as the first frame's left sibling. */
  const frames = collectMemberOrCallChainFrames({
    root,
    sourceText,
  },);
  /** Accumulator built once and frozen as readonly by the return signature. */
  const result: ChainBoundary[] = [];
  for (const frame of frames) {
    /** Effective end of the left sibling, advanced past any closing paren. */
    const from = effectiveEnd({
      node: frame.leftSibling,
      sourceText,
    },);
    /** Boundary token: `.` / `[` / `(` / `?.` per frame shape. */
    const token = memberOrCallBoundaryToken(frame,);
    /** Byte offset of the boundary token; -1 when the scan fails. */
    const offset = findBoundaryOffset({
      sourceText,
      from,
      token,
    },);
    if (offset === (-1))
      continue;
    /** Type arguments range, only present on `CallExpression` frames. */
    const typeArguments = (frame.node.type === 'CallExpression')
      ? frame.node.typeArguments
      : null;
    /** Whether the slice between left sibling and boundary is autofix-safe. */
    const canFix = isInterSegmentClean({
      sourceText,
      from,
      boundaryOffset: offset,
      typeArguments,
    },);
    /** Frame kind for threshold checks: only member boundaries count for "multi-step access". */
    const kind: 'call' | 'member' = (frame.node.type === 'MemberExpression')
      ? 'member'
      : 'call';
    result.push({
      offset,
      canFix,
      kind,
    },);
  }
  return result;
}

/**
 * Parameters for {@link buildChainFix}.
 */
type BuildChainFixParams = {
  /** Fixer instance from the lint report callback. */
  readonly fixer: Fixer;
  /** Chain root; its column defines the continuation indent. */
  readonly root: Span;
  /** Full file source text. */
  readonly sourceText: string;
  /** Boundaries to break before, all of which must be clean. */
  readonly boundaries: readonly ChainBoundary[];
};

/**
 * Builds the autofix as one `insertTextBeforeRange` per boundary.
 *
 * Each insertion lands at a unique byte offset and never overlaps another, so
 * the fixer applies them atomically. The continuation indent is two spaces
 * deeper than the chain root's line, matching the break-before convention
 * already used elsewhere in this plugin and across the codebase.
 *
 * @returns array of `Fix` records, one per boundary
 */
function buildChainFix({
  fixer,
  root,
  sourceText,
  boundaries,
}: BuildChainFixParams,): Fix[] {
  /** Whitespace prefix of the chain root's line; the break-before continuation indents two spaces deeper. */
  const baseIndent = baseIndentAt({
    sourceText,
    offset: root.start,
  },);
  /** Continuation indent: two spaces deeper than the chain root. */
  const childIndent = `${baseIndent}  `;
  return boundaries.map(function asInsertion(boundary,): Fix {
    return fixer.insertTextBeforeRange(
      [
        boundary.offset,
        boundary.offset,
      ],
      `\n${childIndent}`,
    );
  },);
}

/**
 * Enforces one chain segment per source line for binary, logical, member,
 * and call chains.
 *
 * A chain reports when it has at least two boundaries and at least one source
 * line carries two or more of those boundaries. The autofix inserts
 * `\n + indent` before each boundary token, matching this codebase's
 * break-before continuation style; the fix is suppressed when any
 * inter-segment slice contains a comment, a TS non-null assertion, or other
 * foreign content. `no-mixed-operators` runs alongside this rule and remains
 * the authority on precedence-clarifying parens; their fixes are disjoint by
 * construction.
 *
 * @example
 * ```ts
 * // Bad
 * const r1 = a + b + c;
 * const r2 = items.map(toName).filter(isReady).sort();
 *
 * // Good
 * const r1 = a
 *   + b
 *   + c;
 * const r2 = items
 *   .map(toName)
 *   .filter(isReady)
 *   .sort();
 * ```
 */
export const chainPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require one chain segment per source line for binary, logical, member, and call chains.',
      recommended: true,
    },
    messages: {
      chain:
        'Chain has multiple boundaries on a single line; place each chain segment on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Visitor entry for binary/logical chains. Bails when not the chain root,
     * otherwise reports and proposes the multi-boundary fix.
     *
     * @param node - candidate `BinaryExpression` or `LogicalExpression`
     */
    function checkBinary(node: Span,): void {
      /** Full source text; needed for paren detection, boundary scanning, and indent computation. */
      const sourceText = context.sourceCode.getText();
      /* oxlint-disable typescript/no-unsafe-type-assertion -- BinaryExpression/LogicalExpression visitor nodes always carry the operator, left, right, and parent fields BinaryLikeNode requires */
      /** Node narrowed to the operator-bearing shape used by chain helpers. */
      const root = node as BinaryLikeNode;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      if (!isBinaryChainRoot({
        node: root,
        sourceText,
      },)) {
        return;
      }
      /** Boundaries derived from the chain's operands in source order. */
      const boundaries = binaryBoundaries({
        root,
        sourceText,
      },);
      if (boundaries.length < 2)
        return;
      if (sameLineCount({
        sourceText,
        boundaries,
      },) < 2) {
        return;
      }
      /** Whether every boundary's inter-segment slice is autofix-safe. */
      const allClean = boundaries.every(function clean(b,): boolean {
        return b.canFix;
      },);
      context.report({
        node,
        messageId: 'chain',
        ...allClean
          ? {
            fix(fixer: Fixer,): Fix[] {
              return buildChainFix({
                fixer,
                root,
                sourceText,
                boundaries,
              },);
            },
          }
          : {},
      },);
    }

    /**
     * Visitor entry for member/call chains. Bails when not the chain root,
     * otherwise reports and proposes the multi-boundary fix.
     *
     * @param node - candidate `MemberExpression` or `CallExpression`
     */
    function checkMemberOrCall(node: Span,): void {
      /** Full source text; needed for paren detection, boundary scanning, and indent computation. */
      const sourceText = context.sourceCode.getText();
      /* oxlint-disable typescript/no-unsafe-type-assertion -- MemberExpression/CallExpression visitor nodes always carry the type, optional, object/callee, and parent fields MemberOrCallNode requires */
      /** Node narrowed to the member/call shape used by chain helpers. */
      const root = node as MemberOrCallNode;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      if (!isMemberOrCallChainRoot({
        node: root,
        sourceText,
      },)) {
        return;
      }
      /** Boundaries derived from the chain's frames in source order. */
      const boundaries = memberOrCallBoundaries({
        root,
        sourceText,
      },);
      /** Member-frame boundaries; counted separately because they drive the deep-access threshold. */
      const memberBoundaries = boundaries.filter(function isMember(b,): boolean {
        return b.kind === 'member';
      },);
      /** Call-frame boundaries; counted separately because they drive the method-chain threshold. */
      const callBoundaries = boundaries.filter(function isCall(b,): boolean {
        return b.kind === 'call';
      },);
      // Threshold: fire on method chains (≥ 2 calls) or deep access (≥ 3 members).
      // Allows common idioms on one line:
      //   `obj.method()`           — 1 call, 1 member.
      //   `obj.foo.bar`            — 0 calls, 2 members.
      //   `context.sc.getText()`   — 1 call, 2 members.
      //   `arr[0][1]`              — 0 calls, 2 members.
      // Splits multi-step patterns:
      //   `arr.map(f).filter(g)`   — 2 calls.
      //   `obj.a.b.c`              — 3 members.
      //   `foo().bar().baz()`      — 3 calls.
      if ((callBoundaries.length < MIN_CALLS_FOR_METHOD_CHAIN)
        && (memberBoundaries.length < MIN_MEMBERS_FOR_DEEP_ACCESS))
      {
        return;
      }
      // Already-split chains (each `.x` boundary on its own line) report no
      // member-frame boundary sharing a line; further splits would be churn.
      if (sameLineCount({
        sourceText,
        boundaries: memberBoundaries,
      },) < 2) {
        return;
      }
      /** Whether every member-frame boundary's inter-segment slice is autofix-safe. */
      const allClean = memberBoundaries.every(function clean(b,): boolean {
        return b.canFix;
      },);
      context.report({
        node,
        messageId: 'chain',
        ...allClean
          ? {
            fix(fixer: Fixer,): Fix[] {
              return buildChainFix({
                fixer,
                root,
                sourceText,
                boundaries: memberBoundaries,
              },);
            },
          }
          : {},
      },);
    }

    return {
      BinaryExpression: checkBinary,
      LogicalExpression: checkBinary,
      MemberExpression: checkMemberOrCall,
      CallExpression: checkMemberOrCall,
    };
  },
};
