import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

import { checkItemsPerLine, } from '../utility/item-per-line.ts';

/**
 * Call-like node shape carrying arguments for this rule.
 */
type ArgumentListNode = Span & {
  /**
   * Arguments passed to call-like syntax.
   */
  readonly arguments?: readonly Span[];
};

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
     * Extracts arguments from a call expression and delegates
     * to the shared per-line checker, {@link checkItemsPerLine}.
     *
     * @param node - call expression AST node
     */
    function checkCall(node: ForeignBorrowed<Span>,): void {
      /**
       * Narrowed call-like visitor node used for argument access.
       */
      const callNode = node as ArgumentListNode;
      /**
       * Extract arguments from the call-like node.
       */
      const { arguments: args, } = callNode;
      if (args === undefined)
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

    return {
      CallExpression: checkCall,
      NewExpression: checkCall,
    };
  },
};
