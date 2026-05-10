import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans function expressions assigned to variables.
 *
 * Patterns like `const myFn = function myFn() {}` are redundant:
 * the name appears twice and the binding adds noise for no benefit.
 * Use a `function` declaration instead, which is compatible with
 * TSDoc, supports function overloading, and is easier to scan.
 *
 * Function expressions passed as arguments (callbacks) are **not** affected
 * by this rule because they have no variable binding.
 *
 * @example
 * ```ts
 * // Bad
 * const greet = function greet(name: string): void { };
 * const greet = function(name: string): void { };
 *
 * // Good
 * function greet(name: string): void { }
 * ```
 */
export const noVariableFunctionExpression: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow function expressions assigned to variables. Use function declarations instead.',
      recommended: true,
    },
    messages: {
      forbidden:
        'Function expressions assigned to variables are banned. Use a function declaration instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      VariableDeclaration(node: Span,): void {
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const declNode = node as Span & Record<string, unknown>;
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const declarations = declNode['declarations'] as
          | Record<string, unknown>[]
          | null
          | undefined;
        if (declarations === undefined || declarations === null)
          return;

        for (const declarator of declarations) {
          // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint plugin API is untyped
          const init = declarator['init'] as Record<string, unknown> | null | undefined;
          if (init === undefined || init === null)
            continue;

          if (init['type'] === 'FunctionExpression') {
            context.report({
              node,
              messageId: 'forbidden',
            },);
          }
        }
      },
    } as VisitorWithHooks;
  },
};
