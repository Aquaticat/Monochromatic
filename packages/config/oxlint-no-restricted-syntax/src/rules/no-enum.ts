import type {
  Context,
  CreateOnceRule,
  ESTree,
  VisitorWithHooks,
} from '@oxlint/plugins';

/**
 * Bans `enum` declarations in favor of union types and `as const` literals.
 *
 * Enums generate runtime code, have surprising structural typing behavior,
 * and are less composable than union types. Union types with `as const`
 * provide the same exhaustiveness checking without the drawbacks.
 *
 * @example
 * ```ts
 * // Bad
 * enum Status { Active, Inactive }
 *
 * // Good
 * type Status = 'Active' | 'Inactive';
 * ```
 */
export const noEnum: CreateOnceRule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow enum declarations. Use union types with as const instead.',
      recommended: true,
    },
    messages: {
      forbidden: 'enum declarations are banned. Use union types with as const instead.',
    },
  },
  createOnce(context: Context,): VisitorWithHooks {
    return {
      TSEnumDeclaration(node: ESTree.TSEnumDeclaration,): void {
        context.report({
          node,
          messageId: 'forbidden',
        },);
      },
    };
  },
};
