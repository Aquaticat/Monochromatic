import { SyntheticHttpError, } from './completion-shape.ts';
import { retryAfterMsOf, } from './transient-retry.ts';

/**
 How subscription reports spent allowance.
 */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 How credit balance reports no funds.
 */
const HTTP_PAYMENT_REQUIRED = 402;

/**
 Statuses that mean provider is out of budget rather than unwell.
 */
const BUDGET_REFUSAL_STATUSES: ReadonlySet<number> = new Set([
  HTTP_TOO_MANY_REQUESTS,
  HTTP_PAYMENT_REQUIRED,
],);

/**
 How OpenRouter opens a reply body that carries one upstream endpoint's own
 error instead of a verdict on our account.
 */
const UPSTREAM_ERROR_OPENING = '"message":"Provider returned error"';

/**
 Whether thrown failure is one model's upstream endpoint refusing the call,
 passed on by the aggregator with our account untouched.
 THE SIXTY-SECOND CLASS (XingZ612, 2026-09-19): Inception's shared pool
 rate-limited Mercury 2.5 and OpenRouter answered
 `429 {"error":{"message":"Provider returned error","code":429,"metadata":
 {"raw":"inception/mercury-2.5 is temporarily rate-limited upstream. ...",
 "provider_name":"Inception","provider_error_code":"rate_limit_exceeded",
 "limit_source":"upstream_provider_shared_pool", ...}}}`; read as the
 provider's budget refusal, every such reply held the whole of OpenRouter
 out for 60 s, the editors and refiners (OpenRouter-only seats) read
 unreachable, and the entry stopped three attempts running inside 34
 minutes with every meter wet. The limit is that one model's, so the seat
 is lost for the round and the provider stays where its meter puts it.
 
 @param error - whatever call threw
 
 @returns Whether one model's upstream endpoint, not the provider, refused
 
 @example
 ```ts
 if (isUpstreamModelRefusal({ error, },)) rl.warn(`${modelId}: upstream rate limit, seat lost this round`,);
 ```
 */
export function isUpstreamModelRefusal(
  { error, }: { readonly error: unknown; },
): boolean {
  if (!(error instanceof SyntheticHttpError))
    return false;
  if (error.status !== HTTP_TOO_MANY_REQUESTS)
    return false;
  /**
   Body opening the reply carried.
   */
  const { bodyExcerpt, } = error;
  return bodyExcerpt.includes(UPSTREAM_ERROR_OPENING,);
}

/**
 Whether thrown failure says provider is out of budget.
 
 A subscription reports exhaustion as rate limit,
 while credit balance reports it as payment due.
 Retry ladder already rides transient 429 responses;
 reaching router means ladder exhausted.
 A 429 the aggregator passes on from one model's upstream endpoint is that
 model's refusal, not the provider's (`isUpstreamModelRefusal`).
 
 @param error - whatever call threw
 
 @returns Whether other provider should be asked instead
 
 @example
 ```ts
 if (isBudgetRefusal({ error, },)) budgets.markRefused({ provider, },);
 ```
 */
export function isBudgetRefusal(
  { error, }: { readonly error: unknown; },
): boolean {
  if (!(error instanceof SyntheticHttpError))
    return false;
  if (isUpstreamModelRefusal({ error, },))
    return false;
  return BUDGET_REFUSAL_STATUSES.has(error.status,);
}

/**
 Whether thrown failure says the provider's balance cannot pay for the call.
 THE FOURTEENTH CLASS (hakureico, 2026-09-07): OpenRouter at 0.01 USD read
 wet and answered every call `402: This request requires more credits, or
 fewer max_tokens. You requested up to 131072 tokens, but can only afford
 2411`; held out for the 60 s rate-limit backoff, it came back every minute
 to the same wall, and the seat wait chose its short hold over Hyper's long
 one. A payment refusal is a statement about the balance, not about the
 minute, so the budget layer reads the provider dry until its meter moves.
 
 @param error - whatever call threw
 
 @returns Whether the provider's balance refused the call
 
 @example
 ```ts
 await budgets.markRefused({ provider, signal, paymentRequired: isPaymentRefusal({ error, },), },);
 ```
 */
export function isPaymentRefusal(
  { error, }: { readonly error: unknown; },
): boolean {
  if (!(error instanceof SyntheticHttpError))
    return false;
  return error.status === HTTP_PAYMENT_REQUIRED;
}

/**
 Wait a refusal names for its provider's return, zero when it names none or
 when the failure is not a provider reply.
 
 Hyper's daily limit answers "You've hit your daily rate limit. Please try
 again in 2h25m18s" (Huasheng, 2026-09-07); a hold shorter than that walks
 straight back into the same wall, which the router did every 60 s for
 2h53m.
 
 @param error - whatever call threw
 
 @returns Milliseconds the provider asked us to stay away
 
 @example
 ```ts
 await budgets.markRefused({ provider, signal, statedWaitMs: statedWaitMsOf({ error, },), },);
 ```
 */
export function statedWaitMsOf({ error, }: { readonly error: unknown; },): number {
  if (!(error instanceof SyntheticHttpError))
    return 0;
  return retryAfterMsOf({ bodyText: error.bodyExcerpt, },);
}
