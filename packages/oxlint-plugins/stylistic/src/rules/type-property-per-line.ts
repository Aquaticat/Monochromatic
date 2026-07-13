import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Type body node shape carrying members under oxlint's type-literal variants.
 */
type TypeMemberListNode = Span & {
  /**
   * Interface body members in source order.
   */
  readonly body?: readonly Span[];
  /**
   * Type literal members in source order.
   */
  readonly members?: readonly Span[];
};

/**
 * Enforces one member per line in type literals and interface bodies
 * with 2 or more members.
 *
 * Covers both `type Foo = { a: string; b: number }` and
 * `interface Foo { a: string; b: number }` (though interfaces are
 * discouraged, they appear in `.d.ts` files).
 *
 * @example
 * ```ts
 * // Bad
 * type Config = { host: string; port: number };
 *
 * // Good
 * type Config = {
 *   host: string;
 *   port: number;
 * };
 * ```
 */
export const typePropertyPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each type/interface member to be on its own line when there are 2 or more.',
      recommended: true,
    },
    messages: {
      typePropertyPerLine: 'Each type/interface member must be on its own line.',
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
    /**
     * Checks a type literal or interface body for per-line compliance.
     *
     * @param node - TSTypeLiteral or TSInterfaceBody AST node
     */
    function checkBody(node: ForeignBorrowed<Span>,): void {
      /**
       * Narrowed type-body visitor node used for member access.
       */
      const bodyNode = node as TypeMemberListNode;
      /**
       * Members under either key; AST differs between `TSTypeLiteral` and `TSInterfaceBody`.
       */
      const {
        body,
        members: literalMembers,
      } = bodyNode;
      /**
       * Combined member list regardless of oxlint's node-shape variant.
       */
      const members = body ?? literalMembers;
      if (members === undefined)
        return;

      checkItemsPerLine({
        context,
        container: bodyNode,
        items: members,
        messageId: 'typePropertyPerLine',
        bracketPair: {
          open: '{',
          close: '}',
        },
        delimiter: ';',
      },);
    }

    return {
      TSTypeLiteral: checkBody,
      TSInterfaceBody: checkBody,
    };
  },
};
