import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Import specifier shape needed to detect named specifiers.
 */
type ImportSpecifierNode = Span & {
  /**
   * ESTree node type discriminator.
   */
  readonly type?: string;
};

/**
 * Import declaration node shape carrying specifiers for this rule.
 */
type ImportSpecifierListNode = Span & {
  /**
   * Import specifiers in source order.
   */
  readonly specifiers?: readonly ImportSpecifierNode[];
};

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
    return {
      ImportDeclaration(node: ForeignBorrowed<Span>,): void {
        /**
         * Narrowed import visitor node used for specifier access.
         */
        const importNode = node as ImportSpecifierListNode;
        /**
         * Extract specifiers from the import declaration.
         */
        const { specifiers, } = importNode;
        if (specifiers === undefined)
          return;

        /**
         * Filter to only named import specifiers (skip default and namespace).
         */
        const namedSpecifiers = specifiers.filter(
          function isNamed(
            specifier: ForeignBorrowed<(typeof specifiers)[number]>,
          ): boolean {
            return specifier.type
              === 'ImportSpecifier';
          },
        );

        if (namedSpecifiers.length
          < 2)
          return;

        checkItemsPerLine({
          context,
          container: importNode,
          items: namedSpecifiers,
          messageId: 'importPerLine',
          bracketPair: {
            open: '{',
            close: '}',
          },
        },);
      },
    };
  },
};
