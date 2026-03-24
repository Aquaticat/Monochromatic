// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Enforces one element per line in tuple types with 2 or more elements.
 *
 * @example
 * ```ts
 * // Bad
 * type Pair = [string, number];
 *
 * // Good
 * type Pair = [
 *   string,
 *   number,
 * ];
 * ```
 */
export const tuplePerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each tuple element to be on its own line when there are 2 or more elements.',
      recommended: true,
    },
    messages: {
      tuplePerLine:
        'Each tuple element must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      TSTupleType(node: Span,): void {
        const tupleNode = node as Span & Record<string, unknown>;
        const elements = tupleNode['elementTypes'] as Span[] | null | undefined;
        if (elements === undefined || elements === null)
          return;

        checkItemsPerLine({
          context,
          container: tupleNode,
          items: elements,
          messageId: 'tuplePerLine',
        },);
      },
    } as VisitorWithHooks;
  },
};
