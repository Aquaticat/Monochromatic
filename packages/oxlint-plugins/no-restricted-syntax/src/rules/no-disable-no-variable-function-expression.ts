import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-variable-function-expression`,
 * built via {@link banDisableRule}.
 * Use function declarations instead of `const fn = function() {}`.
 */
export const noDisableNoVariableFunctionExpression: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-variable-function-expression',
  description:
    'Disallow disabling no-variable-function-expression. Use function declarations.',
  message:
    'Disabling no-variable-function-expression is not allowed. Use a function declaration instead.',
},);
