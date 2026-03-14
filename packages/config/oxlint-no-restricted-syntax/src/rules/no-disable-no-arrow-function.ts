import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `no-restricted-syntax/no-arrow-function`.
 * Use named function declarations or `.bind(this)` for `this`-capturing callbacks.
 */
export const noDisableNoArrowFunction = banDisableRule({
  ruleId: 'no-restricted-syntax/no-arrow-function',
  description: 'Disallow disabling no-arrow-function. Use named functions or .bind(this).',
  message: 'Disabling no-arrow-function is not allowed. Use named function declarations or .bind(this).',
});
