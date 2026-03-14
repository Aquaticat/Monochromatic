import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `no-non-null-assertion`
 * (including `typescript/no-non-null-assertion` and
 * `typescript-eslint/no-non-null-assertion` variants).
 *
 * Use `notNullishOrThrow()` from `\@monochromatic-dev/module-es`
 * or an explicit null check instead of the `!` postfix operator.
 */
export const noDisableNoNonNullAssertion = banDisableRule({
  ruleId: 'no-non-null-assertion',
  description: 'Disallow disabling no-non-null-assertion. Use notNullishOrThrow() instead.',
  message: 'Disabling no-non-null-assertion is not allowed. Use notNullishOrThrow() or an explicit null check.',
});
