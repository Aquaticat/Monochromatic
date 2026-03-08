import type {
  Context,
  CreateOnceRule,
  Span,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `switch` statements in favor of if/else chains or `Record` lookups.
 *
 * If/else avoids `break` boilerplate and fallthrough bugs.
 * `Record` is preferred when mapping a discriminant to a value.
 *
 * @example
 * ```ts
 * // Bad
 * switch (kind) {
 *   case 'a': return 1;
 *   default: return 0;
 * }
 *
 * // Good -- if/else
 * if (kind === 'a') {
 *   return 1;
 * } else {
 *   return 0;
 * }
 *
 * // Good -- Record lookup
 * const VALUES: Record<string, number> = { a: 1 };
 * return VALUES[kind] ?? 0;
 * ```
 */
export const noSwitch: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow switch statements. Use if/else chains or Record lookups instead.',
      recommended: true,
    },
    messages: {
      forbidden: 'Switch statements are banned. Use if/else chains or Record lookups instead.',
    },
  },
  createOnce(context: Context): VisitorWithHooks {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- oxlint VisitorWithHooks allows arbitrary string keys
    return {
      SwitchStatement(node: Span): void {
        context.report({
          node,
          messageId: 'forbidden',
        });
      },
    } as VisitorWithHooks;
  },
};
