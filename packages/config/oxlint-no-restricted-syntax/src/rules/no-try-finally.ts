import type {
  Context,
  CreateOnceRule,
  Span,
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
      description: 'Disallow try...finally blocks. Use using/await using for cleanup instead.',
      recommended: true,
    },
    messages: {
      forbidden: 'try...finally is banned. Use using/await using with Symbol.dispose for cleanup instead.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      TryStatement(node: Span): void {
        /* Only report when a finalizer (finally block) is present. */
        // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint plugin API is untyped
        const tryNode = node as Span & Record<string, unknown>;
        if (tryNode['finalizer'] !== null && tryNode['finalizer'] !== undefined) {
          context.report({
            node,
            messageId: 'forbidden',
          });
        }
      },
    } as VisitorWithHooks;
  },
};
