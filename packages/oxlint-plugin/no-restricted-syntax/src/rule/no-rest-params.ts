import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Bans rest parameters (`...args`) in function declarations and expressions.
 *
 * Rest parameters obscure the expected shape of function arguments and make
 * call sites harder to read. Accept an explicit array parameter instead,
 * which documents the contract and plays better with TypeScript's type system.
 *
 * This rule fires on rest elements inside function parameter lists.
 * Spread syntax in call expressions and array literals is **not** affected.
 *
 * When the function signature is dictated by an external API or library
 * callback (e.g. event handlers, framework hooks), use `oxlint-disable`.
 *
 * @example
 * ```ts
 * // Bad
 * function log(...messages: string[]): void { }
 *
 * // Good
 * function log(messages: string[]): void { }
 * ```
 */
export const noRestParams: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow rest parameters (...args). Accept an array parameter instead.',
      recommended: true,
    },
    messages: {
      forbidden: 'Rest parameters are banned. Accept an array parameter instead.',
    },
  },
  /**
   * Handles foreign Oxlint callback.
   *
   * @param context - Foreign rule context receiving diagnostics.
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
     * Reports any RestElement found in the function's parameter list.
     *
     * Rest parameters parse as `FormalParameterRest` (AST `type: 'RestElement'`)
     * and appear as the last entry of `Function.params`.
     *
     * @param node - AST node for a function declaration or expression
     */
    function checkFunction(node: ForeignBorrowed<ESTree.Function>,): void {
      for (const param of node.params) {
        if (param.type
          === 'RestElement') {
          context.report({
            node: param,
            messageId: 'forbidden',
          },);
        }
      }
    }

    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
    };
  },
};
