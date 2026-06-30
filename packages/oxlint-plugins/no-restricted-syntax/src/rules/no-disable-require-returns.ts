import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `tsdoc/require-returns`, built via
 * {@link banDisableRule}.
 * Functions that return a value must document it with `\@returns`.
 * The rule already skips `void`, `never`, `Promise<void>`, and `Promise<never>`.
 */
export const noDisableRequireReturns: CreateOnceRule = banDisableRule({
  ruleId: 'tsdoc/require-returns',
  description: 'Disallow disabling tsdoc/require-returns. Add @returns tag instead.',
  message:
    'Disabling tsdoc/require-returns is not allowed. Add a @returns tag to the function.',
},);
