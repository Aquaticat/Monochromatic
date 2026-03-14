import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `no-restricted-syntax/no-try-finally`.
 * Use `using` / `await using` with `Symbol.dispose` / `Symbol.asyncDispose` instead.
 */
export const noDisableNoTryFinally = banDisableRule({
  ruleId: 'no-restricted-syntax/no-try-finally',
  description: 'Disallow disabling no-try-finally. Use using/await using instead.',
  message: 'Disabling no-try-finally is not allowed. Use using/await using with Symbol.dispose instead.',
});
