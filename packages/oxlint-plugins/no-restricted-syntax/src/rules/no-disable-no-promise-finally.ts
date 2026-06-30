import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-promise-finally`, built
 * via {@link banDisableRule}.
 * Use `async`/`await` with `using`/`await using` or restructure the control flow.
 */
export const noDisableNoPromiseFinally: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-promise-finally',
  description: 'Disallow disabling no-promise-finally. Use async/await or using.',
  message:
    'Disabling no-promise-finally is not allowed. Use async/await with using or restructure the flow.',
},);
