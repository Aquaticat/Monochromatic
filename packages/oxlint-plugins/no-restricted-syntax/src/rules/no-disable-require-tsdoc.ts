import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `tsdoc/require-tsdoc`, built via {@link banDisableRule}.
 *
 * TSDoc is required on all declarations. Disabling the rule hides
 * missing documentation and should be replaced with proper TSDoc.
 * The only sanctioned override is the `oxlint.config.ts` file-pattern
 * override for `*.d.ts` files (ambient declarations).
 */
export const noDisableRequireTsdoc: CreateOnceRule = banDisableRule({
  ruleId: 'tsdoc/require-tsdoc',
  description: 'Disallow disabling tsdoc/require-tsdoc. Add proper TSDoc instead.',
  message:
    'Disabling tsdoc/require-tsdoc is not allowed. Add proper TSDoc to the declaration instead.',
},);
