// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Fixer,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { baseIndentAt, } from '../utility/indent.ts';
import { lineAt, } from '../utility/line-at.ts';
import {
  at,
  rangeOf,
} from '../utility/range.ts';

/** Parent types under which a multi-declarator declaration is allowed inline. */
const FOR_PARENT_TYPES = new Set([
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
],);

/**
 * Returns true when every character in `s` is either ASCII whitespace
 * (space, tab, newline, carriage return, form feed, vertical tab) or `,`.
 * Empty strings return true (vacuously). Linear: single pass over the
 * input, no regex backtracking.
 *
 * @param s - candidate slice (typically the source between two declarators)
 *
 * @returns whether the slice is safe to replace verbatim
 */
function isOnlyWhitespaceOrComma(s: string,): boolean {
  for (const c of s) {
    /** Whether the current char is acceptable filler under the autofix shape. */
    const ok = (c === ' ')
      || (c === '\t')
      || (c === '\n')
      || (c === '\r')
      || (c === '\f')
      || (c === '\v')
      || (c === ',');
    if (!ok)
      return false;
  }
  return true;
}

/**
 * Enforces one declarator per line in `var`/`let`/`const`/`using` declarations.
 *
 * Operates in `'always'` mode: every multi-declarator declaration is flagged
 * whenever two consecutive declarators share a source line, regardless of
 * whether either has an initializer.
 *
 * Declarations inside `for`/`for-in`/`for-of` init positions are skipped
 * because the for-statement init slot is not a top-level statement and the
 * one-per-line shape would be syntactically meaningless there.
 *
 * The autofix inserts `,\n<indent>` between same-line declarators. When the
 * inter-declarator source slice contains a comment (anything beyond
 * whitespace and `,`), the fix is suppressed so the comment is preserved;
 * the violation is still reported.
 *
 * @example
 * ```ts
 * // Bad
 * const a = 1, b = 2;
 * let x, y;
 *
 * // Good
 * const a = 1,
 *   b = 2;
 * let x,
 *   y;
 * ```
 */
export const oneVarDeclarationPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each variable declarator to be on its own line when two or more share a declaration.',
      recommended: true,
    },
    messages: {
      expectVarOnNewline: 'Expected variable declaration to be on a new line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks consecutive declarator pairs and reports those that share a line.
     *
     * @param node - VariableDeclaration AST node
     */
    function checkDeclaration(node: Span,): void {
      /** Destructure to access declarators and the for-statement parent escape hatch in one step. */
      const {
        declarations,
        parent,
      } = node as Span & {
        declarations: Span[];
        parent?: { type: string; };
      };
      if (
        (parent !== undefined)
        && FOR_PARENT_TYPES.has(parent.type,)
      ) {
        return;
      }

      if (declarations.length < 2)
        return;

      /** Source text is needed for line-number lookups and inter-declarator slices. */
      const sourceText = context.sourceCode.getText();
      /** Indentation of the declaration keyword; the fix aligns continuations relative to it. */
      const baseIndent = baseIndentAt({
        sourceText,
        offset: rangeOf(node,)[0],
      },);
      /** Continuation indent for declarators after the first; two-space convention matches the rest of the package. */
      const childIndent = `${baseIndent}  `;

      for (let i = 1; i < declarations.length; i++) {
        /** Previous declarator; its end offset is the cut point for the inter-declarator slice. */
        const prev = at({
          arr: declarations,
          index: i - 1,
        },);
        /** Current declarator; its start offset is the other cut point. */
        const curr = at({
          arr: declarations,
          index: i,
        },);
        /** Source range of the previous declarator, queried once. */
        const prevRange = rangeOf(prev,);
        /** Source range of the current declarator, queried once. */
        const currRange = rangeOf(curr,);

        if (
          lineAt({
            sourceText,
            offset: prevRange[1],
          },) !== lineAt({
            sourceText,
            offset: currRange[0],
          },)
        ) {
          continue;
        }

        /** Source slice between the two declarators; comments here block the autofix. */
        const between = sourceText.slice(
          prevRange[1],
          currRange[0],
        );
        /** Whether the inter-declarator slice contains only whitespace and commas (i.e. no comments to preserve). */
        const canFix = isOnlyWhitespaceOrComma(between,);

        context.report({
          node: curr,
          messageId: 'expectVarOnNewline',
          ...canFix
            ? {
              fix(fixer: Fixer,): ReturnType<Fixer['replaceTextRange']> {
                return fixer.replaceTextRange(
                  [
                    prevRange[1],
                    currRange[0],
                  ],
                  `,\n${childIndent}`,
                );
              },
            }
            : {},
        },);
      }
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      VariableDeclaration: checkDeclaration,
    } as VisitorWithHooks;
  },
};
