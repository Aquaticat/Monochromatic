import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/require-destructured-params`,
 * built via {@link banDisableRule}.
 * Functions with 2+ parameters must use a single destructured object parameter.
 */
export const noDisableRequireDestructuredParams: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/require-destructured-params',
  description: 'Disallow disabling require-destructured-params. Use object parameters.',
  message:
    'Disabling require-destructured-params is not allowed. Use a destructured object parameter.',
},);
