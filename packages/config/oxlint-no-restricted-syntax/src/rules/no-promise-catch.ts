import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `.catch()` method calls on promises.
 *
 * Promise `.catch()` encourages imperative error handling alongside `.then()`.
 * Use `try`/`catch` with `async`/`await` instead for consistent, readable
 * error handling that follows the linear control flow of the function.
 *
 * This rule fires on **all** `.catch()` calls, not only on promises,
 * because no other common API uses this method name.
 * Use `oxlint-disable` for the rare legitimate non-promise `.catch()`.
 *
 * @example
 * ```ts
 * // Bad
 * fetchData().catch(handleError);
 *
 * // Good
 * try {
 *   const data = await fetchData();
 * } catch (error: unknown) {
 *   handleError(error);
 * }
 * ```
 */
export const noPromiseCatch: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow .catch() method calls. Use try/catch with async/await instead.',
      recommended: true,
    },
    messages: {
      forbidden: '.catch() is banned. Use try/catch with async/await instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      CallExpression(node: ESTree.CallExpression,): void {
        /** Call target; only `x.catch()` member calls qualify for the rule. */
        const { callee, } = node;
        if ((callee.type !== 'MemberExpression') || callee.computed)
          return;
        if ((callee.property.type !== 'Identifier') || (callee.property.name !== 'catch'))
          return;
        context.report({
          node,
          messageId: 'forbidden',
        },);
      },
    };
  },
};
