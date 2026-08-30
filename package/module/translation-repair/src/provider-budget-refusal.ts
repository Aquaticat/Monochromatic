import { SyntheticHttpError, } from './completion-shape.ts';

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
