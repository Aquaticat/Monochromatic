import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of semantic readonly-effect replacement rule.
 *
 * Parameters require honest types, verified effects, local adapters, or
 * file-class exemption rather than comment bypass.
 */
export const noDisablePreferReadonlyParameterTypes: CreateOnceRule = banDisableRule({
  ruleId: 'prefer-readonly-parameter-type/prefer-readonly-parameter-types',
  description: 'Disallow disabling semantic readonly parameter effect checks.',
  message: 'Disabling prefer-readonly-parameter-types is not allowed. Use an honest type, verified @mutates contract, or local adapter.',
},);
