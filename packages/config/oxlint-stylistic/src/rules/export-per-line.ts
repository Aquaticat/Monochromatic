import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/** Export declaration node shape carrying named specifiers for this rule. */
type ExportSpecifierListNode = Span & {
  /** Inline export declaration, present for `export const` and similar syntax. */
  readonly declaration?: Span | null;
  /** Named export specifiers in source order. */
  readonly specifiers?: readonly Span[] | null;
};

/**
 * Enforces one specifier per line in named export declarations with
 * 2 or more specifiers.
 *
 * Only applies to `export { a, b }` re-export syntax, not inline
 * `export const` or `export function` declarations.
 *
 * @example
 * ```ts
 * // Bad
 * export { foo, bar, baz };
 *
 * // Good
 * export {
 *   foo,
 *   bar,
 *   baz,
 * };
 * ```
 */
export const exportPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each named export specifier to be on its own line when there are 2 or more.',
      recommended: true,
    },
    messages: {
      exportPerLine: 'Each named export specifier must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      ExportNamedDeclaration(node: Span,): void {
        /** Narrowed export visitor node used for declaration and specifier access. */
        const exportNode = node as ExportSpecifierListNode;

        /** Export-specific fields used to skip inline declarations and inspect named specifiers. */
        const {
          declaration,
          specifiers,
        } = exportNode;

        /** Skip inline declarations (`export const x = ...`). */
        if ((declaration !== null)
          && (declaration !== undefined))
        {
          return;
        }

        // Missing specifiers mean the export declaration has nothing to check.
        if ((specifiers === undefined) || (specifiers === null))
          return;

        checkItemsPerLine({
          context,
          container: exportNode,
          items: specifiers,
          messageId: 'exportPerLine',
          bracketPair: {
            open: '{',
            close: '}',
          },
        },);
      },
    };
  },
};
