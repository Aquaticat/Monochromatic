import { banDisableRule } from './_ban-disable-factory.ts';

/**
 * Bans `oxlint-disable` comments that suppress `no-restricted-syntax/no-promise-finally`.
 * Use `async`/`await` with `using`/`await using` or restructure the control flow.
 */
export const noDisableNoPromiseFinally = banDisableRule({
  ruleId: 'no-restricted-syntax/no-promise-finally',
  description: 'Disallow disabling no-promise-finally. Use async/await or using.',
  message: 'Disabling no-promise-finally is not allowed. Use async/await with using or restructure the flow.',
});
