import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Object-pattern node shape carrying destructured properties for this rule.
 */
type ObjectPatternListNode = Span & {
  /**
   * Destructured properties in source order.
   */
  readonly properties?: readonly Span[];
};

/**
 * Enforces one property per line in object destructuring patterns
 * with 2 or more properties.
 *
 * @example
 * ```ts
 * // Bad
 * const { name, age } = person;
 *
 * // Good
 * const {
 *   name,
 *   age,
 * } = person;
 * ```
 */
export const destructurePerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each destructured property to be on its own line when there are 2 or more.',
      recommended: true,
    },
    messages: {
      destructurePerLine: 'Each destructured property must be on its own line.',
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
      ObjectPattern(node: ForeignBorrowed<Span>,): void {
        /**
         * Narrowed object-pattern visitor node used for property access.
         */
        const patternNode = node as ObjectPatternListNode;
        /**
         * Extract properties from the object pattern.
         */
        const { properties, } = patternNode;
        if (properties === undefined)
          return;

        checkItemsPerLine({
          context,
          container: patternNode,
          items: properties,
          messageId: 'destructurePerLine',
          bracketPair: {
            open: '{',
            close: '}',
          },
        },);
      },
    };
  },
};
