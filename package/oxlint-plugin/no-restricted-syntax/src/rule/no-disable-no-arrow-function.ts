import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-arrow-function`, built
 * via {@link banDisableRule}.
 * Use named function declarations or `.bind(this)` for `this`-capturing callbacks.
 */
export const noDisableNoArrowFunction: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-arrow-function',
  description:
    'Disallow disabling no-arrow-function. Use named functions or .bind(this).',
  message:
    'Disabling no-arrow-function is not allowed. Use named function declarations or .bind(this).',
},);
