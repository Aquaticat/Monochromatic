import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `tsdoc/require-returns`.
 * Functions that return a value must document it with `\@returns`.
 * The rule already skips `void`, `never`, `Promise<void>`, and `Promise<never>`.
 */
export const noDisableRequireReturns = banDisableRule({
  ruleId: 'tsdoc/require-returns',
  description: 'Disallow disabling tsdoc/require-returns. Add @returns tag instead.',
  message: 'Disabling tsdoc/require-returns is not allowed. Add a @returns tag to the function.',
});
