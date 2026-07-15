import type { CreateOnceRule, } from '@oxlint/plugins';

import { methodCallBanRule, } from './_method-call-ban-rule.ts';

/**
 * Bans `.finally()` method calls on promises. Built via
 * {@link methodCallBanRule}.
 *
 * Promise `.finally()` is the chaining equivalent of `try...finally`,
 * which is already banned in favor of `using`/`await using` for cleanup.
 * Use `using`/`await using` declarations instead, which tie cleanup
 * to scope exit and compose better than imperative finally blocks.
 *
 * This rule fires on **all** `.finally()` calls, not only on promises,
 * because no other common API uses this method name.
 * Use `oxlint-disable` for the rare legitimate non-promise `.finally()`.
 *
 * @example
 * ```ts
 * // Bad
 * const conn = await connect();
 * fetchData(conn).finally(() => conn.close());
 *
 * // Good
 * await using conn = await connect();
 * await fetchData(conn);
 * ```
 */
export const noPromiseFinally: CreateOnceRule = methodCallBanRule({
  methodNames: ['finally',],
  description:
    'Disallow .finally() method calls. Use using/await using for cleanup instead.',
  message: '.finally() is banned. Use using/await using for cleanup instead.',
},);
