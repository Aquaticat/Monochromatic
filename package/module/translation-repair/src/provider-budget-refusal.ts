import { SyntheticHttpError, } from './completion-shape.ts';
import { retryAfterMsOf, } from './transient-retry.ts';

/**
 * How subscription reports spent allowance.
 */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 * How credit balance reports no funds.
 */
const HTTP_PAYMENT_REQUIRED = 402;

/**
 * Statuses that mean provider is out of budget rather than unwell.
 */
const BUDGET_REFUSAL_STATUSES: ReadonlySet<number> = new Set([
  HTTP_TOO_MANY_REQUESTS,
  HTTP_PAYMENT_REQUIRED,
],);

/**
 * Whether thrown failure says provider is out of budget.
 *
 * A subscription reports exhaustion as rate limit,
 * while credit balance reports it as payment due.
 * Retry ladder already rides transient 429 responses;
 * reaching router means ladder exhausted.
 *
 * @param error - whatever call threw
 *
 * @returns Whether other provider should be asked instead
 *
 * @example
 * ```ts
 * if (isBudgetRefusal({ error, },)) budgets.markRefused({ provider, },);
 * ```
 */
export function isBudgetRefusal(
  { error, }: { readonly error: unknown; },
): boolean {
  if (!(error instanceof SyntheticHttpError))
    return false;
  return BUDGET_REFUSAL_STATUSES.has(error.status,);
}

/**
 * Whether thrown failure says the provider's balance cannot pay for the call.
 * THE FOURTEENTH CLASS (hakureico, 2026-09-07): OpenRouter at 0.01 USD read
 * wet and answered every call `402: This request requires more credits, or
 * fewer max_tokens. You requested up to 131072 tokens, but can only afford
 * 2411`; held out for the 60 s rate-limit backoff, it came back every minute
 * to the same wall, and the seat wait chose its short hold over Hyper's long
 * one. A payment refusal is a statement about the balance, not about the
 * minute, so the budget layer reads the provider dry until its meter moves.
 *
 * @param error - whatever call threw
 *
 * @returns Whether the provider's balance refused the call
 *
 * @example
 * ```ts
 * await budgets.markRefused({ provider, signal, paymentRequired: isPaymentRefusal({ error, },), },);
 * ```
 */
export function isPaymentRefusal(
  { error, }: { readonly error: unknown; },
): boolean {
  if (!(error instanceof SyntheticHttpError))
    return false;
  return error.status === HTTP_PAYMENT_REQUIRED;
}

/**
 * Wait a refusal names for its provider's return, zero when it names none or
 * when the failure is not a provider reply.
 *
 * Hyper's daily limit answers "You've hit your daily rate limit. Please try
 * again in 2h25m18s" (Huasheng, 2026-09-07); a hold shorter than that walks
 * straight back into the same wall, which the router did every 60 s for
 * 2h53m.
 *
 * @param error - whatever call threw
 *
 * @returns Milliseconds the provider asked us to stay away
 *
 * @example
 * ```ts
 * await budgets.markRefused({ provider, signal, statedWaitMs: statedWaitMsOf({ error, },), },);
 * ```
 */
export function statedWaitMsOf({ error, }: { readonly error: unknown; },): number {
  if (!(error instanceof SyntheticHttpError))
    return 0;
  return retryAfterMsOf({ bodyText: error.bodyExcerpt, },);
}
