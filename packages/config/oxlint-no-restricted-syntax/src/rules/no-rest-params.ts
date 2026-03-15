import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

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
  createOnce(context: Context,): VisitorWithHooks {
    /**
     * Checks whether a function node has a rest parameter as its last param
     * and reports it.
     *
     * @param node - AST node for a function declaration or expression
     */
    function checkFunction(node: Span,): void {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const fnNode = node as Span & Record<string, unknown>;
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const params = fnNode['params'] as Record<string, unknown> | null | undefined;
      if (params === undefined || params === null)
        return;

      /* oxc wraps parameters in a `FormalParameters` node with an `items` array and a `rest` property. */
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const rest = params['rest'] as (Span & Record<string, unknown>) | null | undefined;
      if (rest !== undefined && rest !== null) {
        context.report({
          node: rest,
          messageId: 'forbidden',
        },);
        return;
      }

      /* Fallback: check if params has an `items` array with a RestElement. */
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
      const items = params['items'] as Record<string, unknown>[] | null | undefined;
      if (items === undefined || items === null)
        return;
      for (const param of items) {
        if (param['type'] === 'RestElement') {
          context.report({
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
            node: param as unknown as Span,
            messageId: 'forbidden',
          },);
        }
      }
    }

    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      FunctionDeclaration: checkFunction,
      FunctionExpression: checkFunction,
    } as VisitorWithHooks;
  },
};
