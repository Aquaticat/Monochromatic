import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress
 * `no-restricted-syntax/no-variable-function-expression`.
 * Use function declarations instead of `const fn = function() {}`.
 */
export const noDisableNoVariableFunctionExpression = banDisableRule({
  ruleId: 'no-restricted-syntax/no-variable-function-expression',
  description: 'Disallow disabling no-variable-function-expression. Use function declarations.',
  message: 'Disabling no-variable-function-expression is not allowed. Use a function declaration instead.',
});
