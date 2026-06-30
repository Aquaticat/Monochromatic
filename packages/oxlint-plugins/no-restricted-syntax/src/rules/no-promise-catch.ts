import type { CreateOnceRule, } from '@oxlint/plugins';

import { methodCallBanRule, } from './_method-call-ban-rule.ts';

/**
 * Bans `.catch()` method calls on promises. Built via
 * {@link methodCallBanRule}.
 *
 * Promise `.catch()` encourages imperative error handling alongside `.then()`.
 * Use `try`/`catch` with `async`/`await` instead for consistent, readable
 * error handling that follows the linear control flow of the function.
 *
 * This rule fires on **all** `.catch()` calls, not only on promises,
 * because no other common API uses this method name.
 * Use `oxlint-disable` for the rare legitimate non-promise `.catch()`.
 *
 * @example
 * ```ts
 * // Bad
 * fetchData().catch(handleError);
 *
 * // Good
 * try {
 *   const data = await fetchData();
 * } catch (error: unknown) {
 *   handleError(error);
 * }
 * ```
 */
export const noPromiseCatch: CreateOnceRule = methodCallBanRule({
  methodNames: ['catch',],
  description:
    'Disallow .catch() method calls. Use try/catch with async/await instead.',
  message: '.catch() is banned. Use try/catch with async/await instead.',
},);
