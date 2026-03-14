import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `tsdoc/require-tsdoc`.
 *
 * TSDoc is required on all declarations. Disabling the rule hides
 * missing documentation and should be replaced with proper TSDoc.
 * The only sanctioned override is the `.oxlintrc.json` file-pattern
 * override for `*.d.ts` files (ambient declarations).
 *
 * @example
 * ```ts
 * // Bad
 * // oxlint-disable tsdoc/require-tsdoc
 * const x = 1;
 *
 * // Good
 * /\** Horizontal offset for the grid layout. *\/
 * const x = 1;
 * ```
 */
export const noDisableRequireTsdoc = banDisableRule({
  ruleId: 'tsdoc/require-tsdoc',
  description: 'Disallow disabling tsdoc/require-tsdoc. Add proper TSDoc instead.',
  message: 'Disabling tsdoc/require-tsdoc is not allowed. Add proper TSDoc to the declaration instead.',
});
