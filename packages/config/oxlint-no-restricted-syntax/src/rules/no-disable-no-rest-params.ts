import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-rest-params`.
 * Accept an array parameter instead of using rest parameters (`...args`).
 */
export const noDisableNoRestParams = banDisableRule({
  ruleId: 'no-restricted-syntax/no-rest-params',
  description: 'Disallow disabling no-rest-params. Accept an array parameter instead.',
  message: 'Disabling no-rest-params is not allowed. Accept an array parameter instead of rest parameters.',
});
