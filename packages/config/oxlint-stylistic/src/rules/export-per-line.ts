// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

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
      exportPerLine:
        'Each named export specifier must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ExportNamedDeclaration(node: Span,): void {
        const exportNode = node as Span & Record<string, unknown>;

        /** Skip inline declarations (`export const x = ...`). */
        if (exportNode['declaration'] !== null && exportNode['declaration'] !== undefined)
          return;

        const specifiers = exportNode['specifiers'] as Span[] | null | undefined;
        if (specifiers === undefined || specifiers === null)
          return;

        checkItemsPerLine({
          context,
          container: exportNode,
          items: specifiers,
          messageId: 'exportPerLine',
        },);
      },
    } as VisitorWithHooks;
  },
};
