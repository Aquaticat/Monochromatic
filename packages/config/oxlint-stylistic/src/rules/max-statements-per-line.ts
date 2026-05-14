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

/**
 * Parent node types that allow a single inline child statement
 * (the inner statement does not count toward this line's tally).
 *
 * Mirrors the upstream `@stylistic/max-statements-per-line` regex:
 * `if (a) foo();` counts as 1 statement (the `IfStatement`), the inner
 * `foo()` is exempt; `if (a) foo(); else bar();` counts as 2 because the
 * alternate branch of `IfStatement` is not exempt.
 */
const SINGLE_CHILD_ALLOWED = new Set([
  'DoWhileStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'IfStatement',
  'LabeledStatement',
  'WhileStatement',
  'ExportDefaultDeclaration',
  'ExportNamedDeclaration',
],);

/** Statement-shaped AST nodes that contribute to the per-line tally. */
const STATEMENT_TYPES = [
  'BreakStatement',
  'ClassDeclaration',
  'ContinueStatement',
  'DebuggerStatement',
  'DoWhileStatement',
  'ExpressionStatement',
  'ForInStatement',
  'ForOfStatement',
  'ForStatement',
  'FunctionDeclaration',
  'IfStatement',
  'ImportDeclaration',
  'LabeledStatement',
  'ReturnStatement',
  'SwitchStatement',
  'ThrowStatement',
  'TryStatement',
  'VariableDeclaration',
  'WhileStatement',
  'WithStatement',
  'ExportNamedDeclaration',
  'ExportDefaultDeclaration',
  'ExportAllDeclaration',
];

/** Matches inter-statement slices that consist only of whitespace and semicolons. */
const SAFE_TO_FIX = /^[\s;]*$/u;

/**
 * Enforces at most one statement per source line.
 *
 * Mirrors the upstream `@stylistic/max-statements-per-line` semantics with
 * a hard-coded `max` of `1`. Single-child container parents
 * (`if`, `while`, `do-while`, `for`, `for-in`, `for-of`, `labeled`, and
 * `export-default`/`export-named` declarations) exempt their inner
 * statement, so `if (a) foo();` reports zero violations. The alternate
 * branch of an `if`/`else` is not exempt: `if (a) foo(); else bar();`
 * counts as 2 statements and reports `bar()`.
 *
 * The autofix inserts `\n<indent>` between same-line statements. When the
 * inter-statement source slice contains anything beyond whitespace and `;`
 * (a comment, a label, anything non-trivial), the fix is suppressed and
 * the violation is still reported. This preserves inline comments like
 * `foo(); /* note *\/ bar();` rather than deleting them.
 *
 * @example
 * ```ts
 * // Bad
 * const a = 1; const b = 2;
 * if (true) foo(); else bar();
 *
 * // Good
 * const a = 1;
 * const b = 2;
 * if (true) foo();
 * else bar();
 * ```
 */
export const maxStatementsPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require at most one statement per source line.',
      recommended: true,
    },
    messages: {
      exceed:
        'This line has {{count}} statements. Maximum allowed is 1.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /** Statements counted per start-line, in source order. */
    const perLine = new Map<number, Span[]>();

    /**
     * Records a statement under its start-line bucket unless its parent is
     * a single-child container that absorbs it into the parent's tally.
     *
     * @param node - statement AST node
     */
    function trackStatement(node: Span,): void {
      const { parent, } = node as Span & {
        parent?: {
          type: string;
          alternate?: Span;
        };
      };
      if ((parent !== undefined) && SINGLE_CHILD_ALLOWED.has(parent.type,)) {
        const isIfAlternate = (parent.type === 'IfStatement')
          && (parent.alternate === node);
        if (!isIfAlternate) return;
      }

      const sourceText = context.sourceCode.getText();
      const line = lineAt({
        sourceText,
        offset: rangeOf(node,)[0],
      },);
      const bucket = perLine.get(line,) ?? [];
      bucket.push(node,);
      perLine.set(line, bucket,);
    }

    /**
     * On program exit, walks every line bucket and reports each statement
     * past the first.
     */
    function reportExceeding(): void {
      const sourceText = context.sourceCode.getText();
      for (const stmts of perLine.values()) {
        if (stmts.length <= 1) continue;

        const firstRange = rangeOf(at({
          arr: stmts,
          index: 0,
        },),);
        const indent = baseIndentAt({
          sourceText,
          offset: firstRange[0],
        },);

        for (let i = 1; i < stmts.length; i++) {
          const prev = at({
            arr: stmts,
            index: i - 1,
          },);
          const curr = at({
            arr: stmts,
            index: i,
          },);
          const prevEnd = rangeOf(prev,)[1];
          const currStart = rangeOf(curr,)[0];
          // When `curr` is nested inside `prev` (e.g. the alternate of an
          // `IfStatement` whose own range covers the whole `if/else`), the
          // slice `[prevEnd, currStart]` is negative. The fix shape is
          // wrong for this case anyway -- splitting `if (a) foo(); else bar();`
          // requires inserting before `else`, not before `bar()`. Skip the
          // fix and still report.
          const nested = currStart <= prevEnd;
          const between = nested ? '' : sourceText.slice(prevEnd, currStart,);
          const canFix = !nested && SAFE_TO_FIX.test(between,);

          context.report({
            node: curr,
            messageId: 'exceed',
            data: { count: stmts.length, },
            ...canFix
              ? {
                fix(fixer: Fixer,): ReturnType<Fixer['replaceTextRange']> {
                  return fixer.replaceTextRange(
                    [
                      prevEnd,
                      currStart,
                    ],
                    `\n${indent}`,
                  );
                },
              }
              : {},
          },);
        }
      }
      perLine.clear();
    }

    /** Build the visitor: each statement type plus the Program:exit hook. */
    const visitor: Record<string, unknown> = {
      'Program:exit': reportExceeding,
      ...Object.fromEntries(STATEMENT_TYPES.map(
        function asEntry(type,): [string, typeof trackStatement,] {
          return [
            type,
            trackStatement,
          ];
        },
      ),),
    };
    return visitor as VisitorWithHooks;
  },
};
