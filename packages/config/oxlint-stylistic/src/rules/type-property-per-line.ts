// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

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
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks a type literal or interface body for per-line compliance.
     *
     * @param node - TSTypeLiteral or TSInterfaceBody AST node
     */
    function checkBody(node: Span,): void {
      /** Widen `node` to index members under either `body` (interface) or `members` (type literal). */
      const bodyNode = node as Span & Record<string, unknown>;
      /** Members under either key; AST differs between `TSTypeLiteral` and `TSInterfaceBody`. */
      const members = (bodyNode['body'] as Span[] | null | undefined)
        ?? (bodyNode['members'] as Span[] | null | undefined);
      if (members === undefined || members === null)
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

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      TSTypeLiteral: checkBody,
      TSInterfaceBody: checkBody,
    } as VisitorWithHooks;
  },
};
