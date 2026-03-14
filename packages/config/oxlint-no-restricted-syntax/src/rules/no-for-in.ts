import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `for...in` loops in favor of `Object.entries` and functional methods.
 *
 * `for...in` iterates over inherited properties and requires `hasOwnProperty`
 * guards. `Object.entries`/`Object.keys`/`Object.values` with functional
 * methods are safer and more explicit.
 *
 * @example
 * ```ts
 * // Bad
 * for (const key in obj) {
 *   process(obj[key]);
 * }
 *
 * // Good
 * Object.entries(obj).forEach(function processEntry([key, value]) {
 *   process(value);
 * });
 * ```
 */
export const noForIn: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow for...in loops. Use Object.entries/keys/values with functional methods instead.',
      recommended: true,
    },
    messages: {
      forbidden: 'for...in loops are banned. Use Object.entries/keys/values with functional methods instead.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      ForInStatement(node: Span): void {
        context.report({
          node,
          messageId: 'forbidden',
        });
      },
    } as VisitorWithHooks;
  },
};
