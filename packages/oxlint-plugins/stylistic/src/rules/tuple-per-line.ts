import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Tuple-type node shape carrying element types for this rule.
 */
type TupleElementListNode = Span & {
  /**
   * Tuple element types in source order.
   */
  readonly elementTypes?: readonly Span[];
};

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
      tuplePerLine: 'Each tuple element must be on its own line.',
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
      TSTupleType(node: ForeignBorrowed<Span>,): void {
        /**
         * Narrowed tuple visitor node used for element type access.
         */
        const tupleNode = node as TupleElementListNode;
        /**
         * Extract elementTypes from the tuple type.
         */
        const { elementTypes: elements, } = tupleNode;
        if (elements === undefined)
          return;

        checkItemsPerLine({
          context,
          container: tupleNode,
          items: elements,
          messageId: 'tuplePerLine',
          bracketPair: {
            open: '[',
            close: ']',
          },
        },);
      },
    };
  },
};
