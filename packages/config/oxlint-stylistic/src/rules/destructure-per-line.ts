// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

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
      destructurePerLine:
        'Each destructured property must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ObjectPattern(node: Span,): void {
        const patternNode = node as Span & Record<string, unknown>;
        const properties = patternNode['properties'] as Span[] | null | undefined;
        if (properties === undefined || properties === null)
          return;

        checkItemsPerLine({
          context,
          container: patternNode,
          items: properties,
          messageId: 'destructurePerLine',
          bracketPair: { open: '{', close: '}', },
        },);
      },
    } as VisitorWithHooks;
  },
};
