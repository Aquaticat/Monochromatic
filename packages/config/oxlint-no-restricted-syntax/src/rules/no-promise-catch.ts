import type {
  Context,
  CreateOnceRule,
  Span,
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
      description: 'Disallow .catch() method calls. Use try/catch with async/await instead.',
      recommended: true,
    },
    messages: {
      forbidden: '.catch() is banned. Use try/catch with async/await instead.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      CallExpression(node: Span): void {
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callNode = node as Span & Record<string, unknown>;
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const callee = callNode['callee'] as Record<string, unknown> | null | undefined;
        if (callee === undefined || callee === null) {
          return;
        }

        if (callee['type'] !== 'MemberExpression' || callee['computed'] === true) {
          return;
        }

        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const property = callee['property'] as Record<string, unknown> | null | undefined;
        if (property === undefined || property === null || property['name'] !== 'catch') {
          return;
        }

        context.report({
          node,
          messageId: 'forbidden',
        });
      },
    } as VisitorWithHooks;
  },
};
