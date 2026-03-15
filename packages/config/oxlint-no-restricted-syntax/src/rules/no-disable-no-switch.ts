import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-switch`.
 * Use if/else chains or `Record` lookups instead of switch statements.
 */
export const noDisableNoSwitch = banDisableRule({
  ruleId: 'no-restricted-syntax/no-switch',
  description: 'Disallow disabling no-switch. Use if/else chains or Record lookups.',
  message:
    'Disabling no-switch is not allowed. Use if/else chains or Record lookups instead.',
},);
