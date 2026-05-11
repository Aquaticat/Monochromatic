import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `try...finally` blocks in favor of `using`/`await using` for cleanup.
 *
 * The `using` declaration with `Symbol.dispose`/`Symbol.asyncDispose` provides
 * deterministic cleanup without the nesting and control flow complexity of
 * `finally` blocks.
 *
 * Only the `finally` clause is banned; `try...catch` without `finally` is fine.
 *
 * @example
 * ```ts
 * // Bad
 * const handle = openResource();
 * try {
 *   await process(handle);
 * } finally {
 *   handle.close();
 * }
 *
 * // Good
 * await using handle = openResource();
 * await process(handle);
 * ```
 */
export const noTryFinally: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Disallow try...finally blocks. Use using/await using for cleanup instead.',
      recommended: true,
    },
    messages: {
      forbidden:
        'try...finally is banned. Use using/await using with Symbol.dispose for cleanup instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      TryStatement(node: ESTree.TryStatement,): void {
        if (node.finalizer !== null) {
          context.report({
            node,
            messageId: 'forbidden',
          },);
        }
      },
    };
  },
};
