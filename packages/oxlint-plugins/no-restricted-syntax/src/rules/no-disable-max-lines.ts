import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `eslint/max-lines`, built via {@link banDisableRule}.
 * Split the file into smaller modules instead of suppressing the line limit.
 */
export const noDisableMaxLines: CreateOnceRule = banDisableRule({
  ruleId: 'eslint/max-lines',
  description: 'Disallow disabling max-lines. Split the file into smaller modules.',
  message:
    'Disabling max-lines is not allowed. 300 lines (excluding blanks and comments) is generous enough that splitting is always feasible. Extract helpers, types, or constants into separate modules. Tests, fixtures, and config files are already exempt.',
},);
