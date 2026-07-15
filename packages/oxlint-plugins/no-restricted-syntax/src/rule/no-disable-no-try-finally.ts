import type { CreateOnceRule, } from '@oxlint/plugins';

import { banDisableRule, } from './_ban-disable-factory.ts';

/**
 * Bans inline suppression of `no-restricted-syntax/no-try-finally`, built via
 * {@link banDisableRule}.
 * Use `using` / `await using` with `Symbol.dispose` / `Symbol.asyncDispose` instead.
 */
export const noDisableNoTryFinally: CreateOnceRule = banDisableRule({
  ruleId: 'no-restricted-syntax/no-try-finally',
  description: 'Disallow disabling no-try-finally. Use using/await using instead.',
  message:
    'Disabling no-try-finally is not allowed. Use using/await using with Symbol.dispose instead.',
},);
