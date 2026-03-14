import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `no-restricted-syntax/no-regexp-exec`.
 * Use `String.prototype.match()` or `String.prototype.matchAll()` instead of `RegExp.exec()`.
 */
export const noDisableNoRegexpExec = banDisableRule({
  ruleId: 'no-restricted-syntax/no-regexp-exec',
  description: 'Disallow disabling no-regexp-exec. Use String.match/matchAll instead.',
  message: 'Disabling no-regexp-exec is not allowed. Use String.match() or String.matchAll() instead.',
});
