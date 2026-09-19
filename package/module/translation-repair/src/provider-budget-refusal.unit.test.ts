/**
 Guards class sixty-two (XingZ612, 2026-09-19): an HTTP 429 that OpenRouter
 passes on from one model's upstream endpoint ("Provider returned error",
 `limit_source` the upstream provider's shared pool) is that model's seat
 failure for the round, not the OpenRouter account's budget. Reading it as
 a budget refusal held the whole provider out for 60 s on every such reply,
 the OpenRouter-only editors and refiners read unreachable, and the entry
 stopped three attempts running. A bare 429 and a 402 stay budget refusals.
 The bodies here are invented provider replies; no corpus content appears.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isBudgetRefusal,
  isUpstreamModelRefusal,
  SyntheticHttpError,
} from '../dist/final/node/index.mjs';

/**
 Status a subscription reports exhaustion as.
 */
const HTTP_TOO_MANY_REQUESTS = 429;

/**
 Status a credit balance reports no funds as.
 */
const HTTP_PAYMENT_REQUIRED = 402;

/**
 Body OpenRouter answers with when one model's upstream endpoint rate-limits
 its shared pool, as XingZ612 received it, with the model renamed.
 */
const UPSTREAM_POOL_BODY = '{"error":{"message":"Provider returned error","code":429,"metadata":{"raw":"cats/whisker-1 is temporarily'
  + ' rate-limited upstream. Please retry shortly, or add your own key to accumulate your rate limits: https://example.invalid'
  + '/settings/integrations","provider_name":"Catnip","is_byok":false,"provider_error_code":"rate_limit_exceeded",'
  + '"limit_source":"upstream_provider_shared_pool","remedy_hint":"Retry shortly, add your own provider key, or route to'
  + ' another provider with provider routing"}}}';

/**
 Body a provider answers with when our own account is rate-limited.
 */
const ACCOUNT_LIMIT_BODY = '{"error":{"message":"Rate limit exceeded: free-models-per-day","code":429}}';

/**
 Body a credit balance answers with when it cannot pay.
 */
const PAYMENT_BODY = '{"error":{"message":"This request requires more credits","code":402}}';

await describe({
  name: 'a 429 passed on from one model\'s upstream endpoint (class sixty-two, XingZ612)',
  children: [
    it({
      name: 'READS the upstream pool limit as the model\'s refusal, not the provider\'s budget',
      fn: async () => {
        const error = new SyntheticHttpError({
          status: HTTP_TOO_MANY_REQUESTS,
          bodyText: UPSTREAM_POOL_BODY,
        },);
        expect(isUpstreamModelRefusal({ error, },),).toBe(true,);
        expect(isBudgetRefusal({ error, },),).toBe(false,);
      },
    },),
    it({
      name: 'KEEPS an account rate limit a budget refusal',
      fn: async () => {
        const error = new SyntheticHttpError({
          status: HTTP_TOO_MANY_REQUESTS,
          bodyText: ACCOUNT_LIMIT_BODY,
        },);
        expect(isUpstreamModelRefusal({ error, },),).toBe(false,);
        expect(isBudgetRefusal({ error, },),).toBe(true,);
      },
    },),
    it({
      name: 'KEEPS a payment refusal a budget refusal whatever its body says',
      fn: async () => {
        const error = new SyntheticHttpError({
          status: HTTP_PAYMENT_REQUIRED,
          bodyText: PAYMENT_BODY,
        },);
        expect(isUpstreamModelRefusal({ error, },),).toBe(false,);
        expect(isBudgetRefusal({ error, },),).toBe(true,);
      },
    },),
    it({
      name: 'READS nothing into a failure that is not a provider reply',
      fn: async () => {
        expect(isUpstreamModelRefusal({ error: new Error('the cat unplugged the router',), },),).toBe(false,);
      },
    },),
  ],
},);
