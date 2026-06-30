import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-trim-left-right`, built
 * via {@link banDisableRule}.
 * Use `trimStart()` and `trimEnd()` instead of the deprecated `trimLeft()` / `trimRight()`.
 */
export const noDisableNoTrimLeftRight: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-trim-left-right',
  description: 'Disallow disabling no-trim-left-right. Use trimStart/trimEnd instead.',
  message:
    'Disabling no-trim-left-right is not allowed. Use trimStart() and trimEnd() instead.',
},);
