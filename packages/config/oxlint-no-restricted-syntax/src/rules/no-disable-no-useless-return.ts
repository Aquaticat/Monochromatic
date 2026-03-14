import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-useless-return`.
 *
 * Since `unicorn/no-useless-undefined` is globally off, the correct fix
 * for the three-way conflict (TS7030 / no-useless-return / no-useless-undefined)
 * is always `return undefined;`. There is never a reason to disable no-useless-return.
 */
export const noDisableNoUselessReturn = banDisableRule({
  ruleId: 'no-useless-return',
  description: 'Disallow disabling no-useless-return. Use return undefined instead.',
  message: 'Disabling no-useless-return is not allowed. Use `return undefined;` instead of bare `return;`.',
});
