import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
import type {
  Context,
  CreateOnceRule,
  Fix,
  Fixer,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { hasParens, } from '../utility/has-parens.ts';

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
      nested: 'Nested binary expression with a different operator requires parentheses.',
    },
  },
  /**
   * Handles effectful plugin callback.
   *
   * @param context - Foreign callback value carrying diagnostic capability.
   *
   * @mutates context - Emits Oxlint diagnostics through foreign rule context.
   *
   * @example
   * ```ts
   * createOnce(context);
   * ```
   */
  createOnce(context: ForeignBorrowed<Context>,): VisitorWithHooks {
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
    function check(node: ForeignBorrowed<Span>,): void {
      /**
       * Source text is needed for `hasParens` to peek at bytes surrounding the operand spans.
       */
      const sourceText = context.sourceCode
        .getText();
      /* oxlint-disable typescript/no-unsafe-type-assertion -- oxlint Span omits operator and operand fields exposed by these visitor nodes */
      /**
       * Parent expression narrowed to operator-bearing child fields.
       */
      const parent = node as Span & {
        readonly operator?: string;
        readonly left: Span & { readonly operator?: string; };
        readonly right: Span & { readonly operator?: string; };
      };
      /* oxlint-enable typescript/no-unsafe-type-assertion */
      for (const child of [
        parent.left,
        parent.right,
      ]) {
        if (child.operator
          === undefined)
          continue;
        if (child.operator
          === parent
          .operator)
          continue;
        if (hasParens({
          child,
          sourceText,
        },)) {
          continue;
        }
        /**
         * Alias so the fixer closure captures the loop value rather than `child` (which TypeScript widens across the for-of).
         */
        const offender = child;
        context.report({
          node,
          messageId: 'nested',
          fix(fixer: ForeignBorrowed<Fixer>,): Fix[] {
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

    return {
      BinaryExpression: check,
      LogicalExpression: check,
    };
  },
};
