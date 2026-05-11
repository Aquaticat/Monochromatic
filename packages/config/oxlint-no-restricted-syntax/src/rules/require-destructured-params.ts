import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Requires function declarations with 2 or more parameters to use
 * a single destructured object parameter (named params pattern).
 *
 * Only fires on `function` declarations, which are always user-controlled.
 * Function expressions passed as callbacks are exempt because their
 * signatures are often dictated by external APIs.
 *
 * @example
 * ```ts
 * // Bad -- multiple positional parameters
 * function createUser(name: string, age: number): User { }
 *
 * // Good -- single destructured object
 * function createUser({ name, age }: { name: string; age: number }): User { }
 *
 * // Good -- single parameter (exempt)
 * function greet(name: string): void { }
 * ```
 */
export const requireDestructuredParams: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Require function declarations with 2+ params to use a single destructured object parameter.',
      recommended: true,
    },
    messages: {
      required:
        'Function declarations with 2+ parameters must use a single destructured object parameter.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      FunctionDeclaration(node: ESTree.Function,): void {
        /** Minimum parameter count that triggers the rule. */
        const minParams = 2;
        if (node.params.length < minParams)
          return;
        context.report({
          node,
          messageId: 'required',
        },);
      },
    };
  },
};
