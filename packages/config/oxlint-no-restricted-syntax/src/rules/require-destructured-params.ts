import type {
  Context,
  CreateOnceRule,
  Span,
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
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      FunctionDeclaration(node: Span): void {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const fnNode = node as Span & Record<string, unknown>;
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const params = fnNode['params'] as Record<string, unknown> | null | undefined;
        if (params === undefined || params === null) {
          return;
        }

        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const items = params['items'] as Record<string, unknown>[] | null | undefined;
        if (items === undefined || items === null) {
          return;
        }

        /** Minimum parameter count that triggers the rule. */
        const minParams = 2;
        if (items.length < minParams) {
          return;
        }

        context.report({
          node,
          messageId: 'required',
        });
      },
    } as VisitorWithHooks;
  },
};
