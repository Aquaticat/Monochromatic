// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Enforces one specifier per line in import declarations with 2 or more
 * named imports.
 *
 * Default imports and namespace imports are not affected; only the named
 * specifiers inside braces are checked.
 *
 * @example
 * ```ts
 * // Bad
 * import { foo, bar, baz } from 'module';
 *
 * // Good
 * import {
 *   foo,
 *   bar,
 *   baz,
 * } from 'module';
 * ```
 */
export const importPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each named import specifier to be on its own line when there are 2 or more.',
      recommended: true,
    },
    messages: {
      importPerLine: 'Each named import specifier must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ImportDeclaration(node: Span,): void {
        /** Widen `node` to index `specifiers` without leaving an untyped cast at the call site. */
        const importNode = node as Span & Record<string, unknown>;
        /** Extract specifiers (typed with record access since each entry will be probed for `type`) from the untyped record cast above. */
        const specifiers = importNode['specifiers'] as
          | (Span & Record<string, unknown>)[]
          | null
          | undefined;
        if (specifiers === undefined || specifiers === null)
          return;

        /** Filter to only named import specifiers (skip default and namespace). */
        const namedSpecifiers = specifiers.filter(
          function isNamed(s,): boolean {
            return s['type'] === 'ImportSpecifier';
          },
        );

        if (namedSpecifiers.length < 2)
          return;

        checkItemsPerLine({
          context,
          container: importNode,
          items: namedSpecifiers as Span[],
          messageId: 'importPerLine',
          bracketPair: {
            open: '{',
            close: '}',
          },
        },);
      },
    } as VisitorWithHooks;
  },
};
