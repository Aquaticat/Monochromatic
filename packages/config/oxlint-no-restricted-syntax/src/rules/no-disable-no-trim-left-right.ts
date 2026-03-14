import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `no-restricted-syntax/no-trim-left-right`.
 * Use `trimStart()` and `trimEnd()` instead of the deprecated `trimLeft()` / `trimRight()`.
 */
export const noDisableNoTrimLeftRight = banDisableRule({
  ruleId: 'no-restricted-syntax/no-trim-left-right',
  description: 'Disallow disabling no-trim-left-right. Use trimStart/trimEnd instead.',
  message: 'Disabling no-trim-left-right is not allowed. Use trimStart() and trimEnd() instead.',
});
