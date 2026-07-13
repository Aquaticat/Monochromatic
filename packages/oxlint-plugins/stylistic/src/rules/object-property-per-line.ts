import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Object-expression node shape carrying properties for this rule.
 */
type ObjectPropertyListNode = Span & {
  /**
   * Object literal properties in source order.
   */
  readonly properties?: readonly Span[];
};

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
      ObjectExpression(node: ForeignBorrowed<Span>,): void {
        /**
         * Narrowed object-expression visitor node used for property access.
         */
        const objNode = node as ObjectPropertyListNode;
        /**
         * Extract properties from the object expression.
         */
        const { properties, } = objNode;
        if (properties === undefined)
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
    };
  },
};
