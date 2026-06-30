import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-promise-catch`, built
 * via {@link banDisableRule}.
 * Use `async`/`await` with `try`/`catch` instead of `.catch()`.
 */
export const noDisableNoPromiseCatch: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-promise-catch',
  description: 'Disallow disabling no-promise-catch. Use async/await with try/catch.',
  message:
    'Disabling no-promise-catch is not allowed. Use async/await with try/catch instead.',
},);
