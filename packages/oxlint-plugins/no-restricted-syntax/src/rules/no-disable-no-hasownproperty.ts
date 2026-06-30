import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-hasownproperty`, built
 * via {@link banDisableRule}.
 * Use `Object.hasOwn()` or the `in` operator instead of `.hasOwnProperty()`.
 */
export const noDisableNoHasownproperty: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-hasownproperty',
  description: 'Disallow disabling no-hasownproperty. Use Object.hasOwn() instead.',
  message:
    'Disabling no-hasownproperty is not allowed. Use Object.hasOwn() or the in operator.',
},);
