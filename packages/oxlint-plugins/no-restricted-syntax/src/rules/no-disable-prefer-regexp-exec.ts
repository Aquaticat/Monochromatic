import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `typescript-eslint/prefer-regexp-exec`, built
 * via {@link banDisableRule}.
 * `RegExp#exec()` is the preferred method for regex matching.
 *
 * @example
 * ```ts
 * // Correct:
 * const match = /pattern/.exec(str);
 * ```
 */
export const noDisablePreferRegexpExec: CreateOnceRule = banDisableRule({
  ruleId: 'typescript-eslint/prefer-regexp-exec',
  description:
    'Disallow disabling prefer-regexp-exec. Use RegExp#exec() instead of String#match().',
  message:
    'Disabling prefer-regexp-exec is not allowed. Use RegExp#exec() instead of String#match().',
},);
