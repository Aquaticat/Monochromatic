// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Enforces one property per line in object literals with 2 or more properties.
 *
 * When an object literal has 2 or more properties, each property must start
 * on its own line. The auto-fix reformats the object accordingly.
 *
 * @example
 * ```ts
 * // Bad
 * const config = { host: 'localhost', port: 3000 };
 *
 * // Good
 * const config = {
 *   host: 'localhost',
 *   port: 3000,
 * };
 * ```
 */
export const objectPropertyPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each object property to be on its own line when there are 2 or more properties.',
      recommended: true,
    },
    messages: {
      propertyPerLine: 'Each object property must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ObjectExpression(node: Span,): void {
        const objNode = node as Span & Record<string, unknown>;
        const properties = objNode['properties'] as Span[] | null | undefined;
        if (properties === undefined || properties === null)
          return;

        checkItemsPerLine({
          context,
          container: objNode,
          items: properties,
          messageId: 'propertyPerLine',
          bracketPair: {
            open: '{',
            close: '}',
          },
        },);
      },
    } as VisitorWithHooks;
  },
};
