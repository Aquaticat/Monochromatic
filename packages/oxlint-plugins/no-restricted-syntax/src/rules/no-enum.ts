import type { CreateOnceRule, } from '@oxlint/plugins';

import { simpleBanRule, } from './_simple-ban-rule.ts';

/**
 * Bans `enum` declarations in favor of union types and `as const` literals.
 * Built via {@link simpleBanRule}.
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
export const noEnum: CreateOnceRule = simpleBanRule({
  type: 'suggestion',
  nodeType: 'TSEnumDeclaration',
  description: 'Disallow enum declarations. Use union types with as const instead.',
  messageId: 'forbidden',
  message: 'enum declarations are banned. Use union types with as const instead.',
},);
