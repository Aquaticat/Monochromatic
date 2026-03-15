import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `typescript/no-misused-promises`.
 *
 * For DOM event handlers, make the outer listener synchronous and wrap
 * async logic in a `void` IIFE with error handling.
 * For bun:test `describe($, ...)` where `$` is async, pass `$.name` instead.
 */
export const noDisableNoMisusedPromises = banDisableRule({
  ruleId: 'typescript/no-misused-promises',
  description:
    'Disallow disabling no-misused-promises. Fix the async callback instead of suppressing.',
  message:
    'Disabling no-misused-promises is not allowed. For event handlers, wrap async logic in a void IIFE with error handling. For bun:test describe labels, pass $.name instead of $.',
},);
