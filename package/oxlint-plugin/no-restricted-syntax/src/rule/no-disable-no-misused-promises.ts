import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `typescript/no-misused-promises`, built via
 * {@link banDisableRule}.
 *
 * For DOM event handlers, make the outer listener synchronous and wrap
 * async logic in a `void` IIFE with error handling.
 */
export const noDisableNoMisusedPromises: CreateOnceRule = banDisableRule({
  ruleId: 'typescript/no-misused-promises',
  description:
    'Disallow disabling no-misused-promises. Fix the async callback instead of suppressing.',
  message:
    'Disabling no-misused-promises is not allowed. For event handlers, wrap async logic in a void IIFE with error handling.',
},);
