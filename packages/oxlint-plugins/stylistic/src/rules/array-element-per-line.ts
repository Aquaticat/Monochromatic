import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Array-expression node shape carrying element spans for this rule.
 */
type ArrayElementListNode = Span & {
  /**
   * Array elements as read by the existing rule behavior.
   */
  readonly elements?: readonly Span[];
};

/**
 * Enforces one element per line in array literals with 2 or more elements.
 *
 * When an array literal has 2 or more elements, each element must start on
 * its own line. The auto-fix reformats the array accordingly.
 *
 * @example
 * ```ts
 * // Bad
 * const items = [1, 2, 3];
 *
 * // Good
 * const items = [
 *   1,
 *   2,
 *   3,
 * ];
 * ```
 */
export const arrayElementPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each array element to be on its own line when there are 2 or more elements.',
      recommended: true,
    },
    messages: {
      elementPerLine: 'Each array element must be on its own line.',
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
      ArrayExpression(node: ForeignBorrowed<Span>,): void {
        /**
         * Narrowed array visitor node used for element access.
         */
        const arrayNode = node as ArrayElementListNode;
        /**
         * Extract elements from the array node.
         */
        const { elements, } = arrayNode;
        if (elements === undefined)
          return;

        checkItemsPerLine({
          context,
          container: arrayNode,
          items: elements,
          messageId: 'elementPerLine',
          bracketPair: {
            open: '[',
            close: ']',
          },
        },);
      },
    };
  },
};
