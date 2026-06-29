import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans optional `catch` bindings.
 *
 * `catch {}` hides the thrown value at the boundary where the failure is
 * observed. Bind the value, usually as `error`, so code can log it, rethrow it,
 * or make the intentional ignore visible in the block.
 *
 * @example
 * ```ts
 * // Bad
 * try {
 *   await run();
 * } catch {
 *   recover();
 * }
 *
 * // Good
 * try {
 *   await run();
 * } catch (caughtError) {
 *   logger.error(caughtError);
 *   recover();
 * }
 * ```
 */
export const noOptionalCatchBinding: CreateOnceRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow optional catch bindings. Use a named catch binding so the thrown value stays available.',
      recommended: true,
    },
    messages: {
      forbidden: [
        'catch without a binding is banned. Use `catch (error) {}` or another ',
        'named binding so the thrown value stays available.',
      ].join('',),
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      CatchClause(node: ESTree.CatchClause,): void {
        if (node.param !== null)
          return;
        context.report({
          node,
          messageId: 'forbidden',
        },);
      },
    };
  },
};
