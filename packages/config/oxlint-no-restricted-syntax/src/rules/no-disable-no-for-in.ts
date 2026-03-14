import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `no-restricted-syntax/no-for-in`.
 * Use `Object.entries`, `Object.keys`, or `Object.values` instead of `for...in`.
 */
export const noDisableNoForIn = banDisableRule({
  ruleId: 'no-restricted-syntax/no-for-in',
  description: 'Disallow disabling no-for-in. Use Object.entries/keys/values.',
  message: 'Disabling no-for-in is not allowed. Use Object.entries, Object.keys, or Object.values instead.',
});
