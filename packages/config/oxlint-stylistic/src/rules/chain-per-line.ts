import type {
  Context,
  CreateOnceRule,
  Fix,
  Fixer,
  SourceCode,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import {
  type ChainNode,
  effectiveTop,
  hasInteriorComment,
  isChainRoot,
} from '../utility/chain.ts';
import { flattenChain, } from '../utility/chain-flatten.ts';
import {
  renderCanonical,
  selectBreakOffsets,
} from '../utility/chain-render.ts';
import { baseIndentAt, } from '../utility/indent.ts';

/** Per-file cache of full source text, keyed by the file's `SourceCode` identity. */
const sourceTextCache = new WeakMap<SourceCode, string>();

/**
 * Returns the file's full source text, computing it once per file.
 *
 * `createOnce` reuses one visitor across files, and the visitor fires on every
 * member, call, binary, and logical node, so recomputing `getText()` per
 * invocation is wasteful. Keying the cache on `SourceCode` identity refreshes
 * it exactly when oxlint moves to the next file. The parameter is the rule
 * `Context` rather than its `sourceCode` directly because oxlint's `SourceCode`
 * is an anonymous type the readonly-params allow-list cannot name-match.
 *
 * @param context - rule context whose `sourceCode` describes the current file
 *
 * @returns full source text of the file `context.sourceCode` describes
 */
function sourceTextOf(context: Context,): string {
  /** Source code accessor identifying the current file. */
  const { sourceCode, } = context;
  /** Cached text for this file, if already computed. */
  const cached = sourceTextCache.get(sourceCode,);
  if (cached !== undefined)
    return cached;
  /** Full source text, computed once and memoised against this `SourceCode`. */
  const text = sourceCode.getText();
  sourceTextCache.set(
    sourceCode,
    text,
  );
  return text;
}

/**
 * Enforces one chain segment per source line for binary, logical, member, and
 * call chains, laid out by a single uniform rule.
 *
 * Firing once on the outermost chain root, the rule flattens the chain into
 * segments, keeps the leaf and the first member or operand on the head line,
 * and breaks every later break point (a member-name step or an operator's
 * right operand) onto its own continuation line indented two spaces deeper.
 * Computed access (`[expr]`) and call steps (`(args)`) stay attached, so
 * `arr[0][1]` and `obj.method()` keep to one line. It reports when the region's
 * source differs from this canonical layout and replaces the whole region in
 * one fix, except when a comment inside the region would be relocated, where it
 * reports without a fix. `no-mixed-operators` runs alongside and remains the
 * authority on precedence parentheses; on a shared region their fixes need two
 * `oxlint --fix` passes (an upstream single-pass limitation).
 *
 * @example
 * ```ts
 * // Bad
 * const r1 = a + b + c;
 * const r2 = items.map(toName).filter(isReady).sort();
 *
 * // Good
 * const r1 = a + b
 *   + c;
 * const r2 = items.map(toName)
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
        'Put each operator, member, or method step in this chain on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Visitor entry for every chain-capable node. Bails unless the node is the
     * outermost root, then reports when its layout is not canonical.
     *
     * @param node - candidate `MemberExpression`, `CallExpression`,
     *   `BinaryExpression`, or `LogicalExpression`
     */
    function check(node: Span,): void {
      /* oxlint-disable typescript/no-unsafe-type-assertion -- visitor nodes always carry the type/object/callee/left/right/operator/parent fields ChainNode reads; oxlint types them only as bare Span */
      /** Node narrowed to the structural view the chain walk reads. */
      const root = node as ChainNode;
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      if (!isChainRoot({
        context,
        node: root,
      },)) {
        return;
      }
      /** Break offsets that begin a continuation line; empty when the chain fits on one line. */
      const breakOffsets = selectBreakOffsets(flattenChain({
        context,
        node: root,
      },),);
      if (breakOffsets.length
        === 0)
        return;
      /** Full source text, cached per file. */
      const sourceText = sourceTextOf(context,);
      /** Outermost region node, past any trailing `!`/`as`/`satisfies` wrapper. */
      const top = effectiveTop(root,);
      /** Byte offset where the chain region begins. */
      const regionStart = root.start;
      /** Byte offset where the chain region ends, past trailing wrapper text. */
      const regionEnd = top.end;
      /** Continuation indent: the head line's indentation plus two spaces. */
      const childIndent = `${
        baseIndentAt({
          sourceText,
          offset: regionStart,
        },)
      }  `;
      /** Canonical multi-line layout of the region. */
      const canonical = renderCanonical({
        sourceText,
        regionStart,
        regionEnd,
        breakOffsets,
        childIndent,
      },);
      if (sourceText.slice(
        regionStart,
        regionEnd,
      )
        === canonical) {
        return;
      }
      /** Whether the region is free of comments the render would relocate. */
      const fixable = !hasInteriorComment({
        context,
        node: top,
      },);
      context.report({
        node,
        messageId: 'chain',
        ...fixable
          ? {
            fix(fixer: Fixer,): Fix {
              return fixer.replaceTextRange(
                [
                  regionStart,
                  regionEnd,
                ],
                canonical,
              );
            },
          }
          : {},
      },);
    }

    return {
      BinaryExpression: check,
      LogicalExpression: check,
      MemberExpression: check,
      CallExpression: check,
    };
  },
};
