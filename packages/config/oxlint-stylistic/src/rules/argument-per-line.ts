// oxlint-disable typescript/no-unsafe-assignment, typescript/no-unsafe-member-access, typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Enforces one argument per line in function calls with 2 or more arguments.
 *
 * When a function call has 2 or more arguments, each argument must start on
 * its own line. The auto-fix reformats the argument list accordingly.
 *
 * @example
 * ```ts
 * // Bad
 * doSomething(foo, bar, baz);
 *
 * // Good
 * doSomething(
 *   foo,
 *   bar,
 *   baz,
 * );
 * ```
 */
export const argumentPerLine: CreateOnceRule = {
  meta: {
    type: 'layout',
    fixable: 'whitespace',
    docs: {
      description:
        'Require each function call argument to be on its own line when there are 2 or more arguments.',
      recommended: true,
    },
    messages: {
      argumentPerLine: 'Each function call argument must be on its own line.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Extracts arguments from a call expression and delegates
     * to the shared per-line checker.
     *
     * @param node - call expression AST node
     */
    function checkCall(node: Span,): void {
      const callNode = node as Span & Record<string, unknown>;
      const args = callNode['arguments'] as Span[] | null | undefined;
      if (args === undefined || args === null)
        return;

      checkItemsPerLine({
        context,
        container: callNode,
        items: args,
        messageId: 'argumentPerLine',
        bracketPair: {
          open: '(',
          close: ')',
        },
      },);
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      CallExpression: checkCall,
      NewExpression: checkCall,
    } as VisitorWithHooks;
  },
};
