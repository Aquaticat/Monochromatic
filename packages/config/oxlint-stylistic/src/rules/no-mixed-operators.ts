// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Fix,
  Fixer,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Determines whether an AST node's source text is wrapped in matching
 * parentheses, allowing whitespace between the parens and the node span.
 *
 * oxc/ESTree binary expressions do not include surrounding parens in their
 * `start`/`end` range, so this helper peeks at the source text immediately
 * before `start` and after `end` and tolerates intermediate whitespace
 * (e.g. `( a + b )`).
 *
 * @param child - AST node to inspect
 *
 * @param sourceText - full source text of the file
 *
 * @returns true if the node is wrapped in `( ... )` at its boundary
 *
 * @example
 * ```ts
 * // For source `(a + b) * c`, with child = BinaryExpression `a + b`:
 * hasParens({ child, sourceText, }); // true
 * ```
 */
function hasParens({
  child,
  sourceText,
}: {
  child: Span;
  sourceText: string;
},): boolean {
  return /\(\s*$/.test(sourceText.slice(
    0,
    child.start,
  ),)
    && /^\s*\)/.test(sourceText.slice(child.end,),);
}

/**
 * Reports nested binary or logical expressions whose operator differs from
 * the parent's operator unless they are wrapped in parentheses.
 *
 * Same-operator chains (`a + b + c`, `x && y && z`) are permitted because
 * they are unambiguous under associativity. Mixed operators (`a + b * c`,
 * `x || y && z`) must be disambiguated with explicit parens so precedence
 * is visible at the call site.
 *
 * @example
 * ```ts
 * // Bad: precedence is implicit
 * const r1 = a + b * c;
 * const r2 = x || y && z;
 *
 * // Good: same-operator chain
 * const r3 = a + b + c;
 *
 * // Good: explicit parens
 * const r4 = a + (b * c);
 * const r5 = (x || y) && z;
 * ```
 */
export const noMixedOperators: CreateOnceRule = {
  meta: {
    type: 'problem',
    fixable: 'code',
    docs: {
      description:
        'Require parentheses around nested binary or logical expressions whose operator differs from the parent.',
      recommended: true,
    },
    messages: {
      nested:
        'Nested binary expression with a different operator requires parentheses.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks both children of a BinaryExpression or LogicalExpression and
     * reports the parent node once for each child that mixes operators
     * without parens.
     *
     * Why the auto-fix is safe: it wraps each offending child in `(...)`
     * at the operand's existing AST range. Parentheses are a precedence-
     * neutral grouping; they cannot alter evaluation order because they
     * are inserted at the exact span the parser already grouped the
     * operands at. The original AST captures the parsed associativity, so
     * post-fix bytes re-parse to the same AST. No short-circuit order,
     * operator precedence, or side-effect sequence changes. The wrap is
     * tight against the operand's byte range so existing surrounding
     * whitespace and line breaks are preserved verbatim.
     *
     * @param node - parent BinaryExpression or LogicalExpression
     */
    function check(node: Span,): void {
      /** Source text is needed for `hasParens` to peek at bytes surrounding the operand spans. */
      const sourceText = context.sourceCode.getText();
      /** Widen `node` so operator/left/right can be accessed without leaving an untyped cast at every use. */
      const parent = node as Span & {
        operator?: string;
        left: Span & { operator?: string; };
        right: Span & { operator?: string; };
      };
      for (const child of [
        parent.left,
        parent.right,
      ]) {
        if (child.operator === undefined) continue;
        if (child.operator === parent.operator) continue;
        if (hasParens({
          child,
          sourceText,
        },)) continue;
        /** Alias so the fixer closure captures the loop value rather than `child` (which TypeScript widens across the for-of). */
        const offender = child;
        context.report({
          node,
          messageId: 'nested',
          fix(fixer: Fixer,): Fix[] {
            return [
              fixer.insertTextBeforeRange(
                [
                  offender.start,
                  offender.end,
                ],
                '(',
              ),
              fixer.insertTextAfterRange(
                [
                  offender.start,
                  offender.end,
                ],
                ')',
              ),
            ];
          },
        },);
      }
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      BinaryExpression: check,
      LogicalExpression: check,
    } as VisitorWithHooks;
  },
};
