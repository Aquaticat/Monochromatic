import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans arrow function expressions in favor of named function declarations
 * and named function expressions.
 *
 * Arrow functions produce anonymous entries in stack traces, making debugging
 * harder. Named functions provide clear trace names, are hoisted for flexible
 * ordering, and signal intent more explicitly.
 *
 * @example
 * ```ts
 * // Bad
 * const double = (x: number): number => x * 2;
 * items.map((item) => item.value);
 *
 * // Good
 * function double(x: number): number { return x * 2; }
 * items.map(function getValue(item) { return item.value; });
 * ```
 */
export const noArrowFunction: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow arrow function expressions. Use named function declarations or named function expressions instead.',
      recommended: true,
    },
    messages: {
      forbidden: 'Arrow functions are banned. Use named function declarations or named function expressions instead.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ArrowFunctionExpression(node: Span): void {
        context.report({
          node,
          messageId: 'forbidden',
        });
      },
    } as VisitorWithHooks;
  },
};
