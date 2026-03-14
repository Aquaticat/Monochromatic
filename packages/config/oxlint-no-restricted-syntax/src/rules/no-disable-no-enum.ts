import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-enum`.
 * Use union types with `as const` instead of TypeScript enums.
 */
export const noDisableNoEnum = banDisableRule({
  ruleId: 'no-restricted-syntax/no-enum',
  description: 'Disallow disabling no-enum. Use union types instead.',
  message: 'Disabling no-enum is not allowed. Use union types with as const instead of enums.',
});
