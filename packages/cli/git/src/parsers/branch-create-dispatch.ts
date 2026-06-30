import { branchConsumesNextValue, } from './branch-create-branch-options.ts';
import { checkoutConsumesNextValue, } from './branch-create-checkout-options.ts';
import { switchConsumesNextValue, } from './branch-create-switch-options.ts';
import type { BranchCreationSubcommand, } from './branch-create-types.ts';

//region Subcommand dispatch helpers

/**
 * Options for testing whether an argv token consumes the following token.
 */
type ConsumesNextValueOptions = {
  /**
   * Guarded subcommand whose option vocabulary applies.
   */
  readonly subcommand: BranchCreationSubcommand;
  /**
   * Argv token to inspect.
   */
  readonly arg: string;
};

/**
 * Reports whether option consumes the next argv token as a value, dispatching
 * to {@link branchConsumesNextValue}, {@link checkoutConsumesNextValue}, or
 * {@link switchConsumesNextValue} by subcommand.
 *
 * @param subcommand - Guarded subcommand whose option vocabulary applies.
 *
 * @param arg - Argv token to inspect.
 *
 * @returns `true` when next token is a value, not another wrapper flag.
 *
 * @example
 * ```ts
 * consumesNextValue({ subcommand: 'switch', arg: '--create' });
 * // => true
 * ```
 */
export function consumesNextValue({
  subcommand,
  arg,
}: ConsumesNextValueOptions,): boolean {
  if (subcommand === 'branch')
    return branchConsumesNextValue(arg,);

  if (subcommand === 'checkout')
    return checkoutConsumesNextValue(arg,);

  return switchConsumesNextValue(arg,);
}

//endregion Subcommand dispatch helpers
