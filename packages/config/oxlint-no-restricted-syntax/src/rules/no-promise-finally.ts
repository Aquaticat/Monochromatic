import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `.finally()` method calls on promises.
 *
 * Promise `.finally()` is the chaining equivalent of `try...finally`,
 * which is already banned in favor of `using`/`await using` for cleanup.
 * Use `using`/`await using` declarations instead, which tie cleanup
 * to scope exit and compose better than imperative finally blocks.
 *
 * This rule fires on **all** `.finally()` calls, not only on promises,
 * because no other common API uses this method name.
 * Use `oxlint-disable` for the rare legitimate non-promise `.finally()`.
 *
 * @example
 * ```ts
 * // Bad
 * const conn = await connect();
 * fetchData(conn).finally(() => conn.close());
 *
 * // Good
 * await using conn = await connect();
 * await fetchData(conn);
 * ```
 */
export const noPromiseFinally: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow .finally() method calls. Use using/await using for cleanup instead.',
      recommended: true,
    },
    messages: {
      forbidden: '.finally() is banned. Use using/await using for cleanup instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      CallExpression(node: ESTree.CallExpression,): void {
        /** Call target; only `x.finally()` member calls qualify for the rule. */
        const { callee, } = node;
        if ((callee.type !== 'MemberExpression') || callee.computed)
          return;
        if ((callee.property.type !== 'Identifier')
          || (callee.property.name !== 'finally'))
        {
          return;
        }
        context.report({
          node,
          messageId: 'forbidden',
        },);
      },
    };
  },
};
