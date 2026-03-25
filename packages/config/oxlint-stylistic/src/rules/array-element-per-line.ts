// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

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
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ArrayExpression(node: Span,): void {
        const arrayNode = node as Span & Record<string, unknown>;
        const elements = arrayNode['elements'] as Span[] | null | undefined;
        if (elements === undefined || elements === null)
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
    } as VisitorWithHooks;
  },
};
