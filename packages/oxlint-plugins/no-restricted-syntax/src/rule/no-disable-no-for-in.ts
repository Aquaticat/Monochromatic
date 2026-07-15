import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-for-in`, built via
 * {@link banDisableRule}.
 * Use `Object.entries`, `Object.keys`, or `Object.values` instead of `for...in`.
 */
export const noDisableNoForIn: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-for-in',
  description: 'Disallow disabling no-for-in. Use Object.entries/keys/values.',
  message:
    'Disabling no-for-in is not allowed. Use Object.entries, Object.keys, or Object.values instead.',
},);
