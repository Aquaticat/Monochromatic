/**
 Guards class one hundred forty-eight (hulicaijia29, 2026-09-26): Bedrock
 served one Gemma model at 219 to 263 s a stream for fifty minutes while its
 other models kept their pace, and every round waited on that seat up to the
 360 s deadline. A call cut at its card's measured stream bound now holds
 that provider out for that model: the call is asked again of the next
 provider serving the model, a model no other provider serves reads
 unreachable without a call, and the provider's other models are served.
 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  createRoutingClient,
  NoProviderForModelError,
  type ProviderName,
  type ProviderRecord,
  StreamBoundError,
  StreamCutShortError,
} from '../dist/final/node/index.mjs';
import { textCallOutcome, } from './provider-router-text-call.test-fixture.ts';
import { stubWetBudgets, } from './provider-router-wet-budgets.test-fixture.ts';
import {
  SEAT_BEDROCK_ONLY_TEXT,
  SEAT_HYPER_TEXT_BEDROCK,
} from './roster-seats.test-fixture.ts';

/**
 How long the router holds a provider out for one model in these cases.
 */
const HOLD_MS = 1_000;

/**
 The bound the stub's cut names.
 */
const BOUND_MS = 60_000;

/**
 Plain text conversation reused across routed calls.
 */
const MESSAGES = [
  {
    role: 'user' as const,
    content: '这只猫在窗台上睡了多久？',
  },
];

/**
 Abort signal every routed call carries.
 */
const SIGNAL = new AbortController().signal;

/**
 Builds stub providers where Bedrock cuts each named model once at its
 stream bound, then answers.

 @param slow - models Bedrock cuts on their first call

 @returns Callers plus every provider and model asked, in order

 @example
 ```ts
 const { callers, asked, } = stubProviders({ slow: [SEAT_BEDROCK_ONLY_TEXT,], },);
 ```
 */
function stubProviders({ slow, }: { readonly slow: readonly string[]; },): {
  readonly callers: ProviderRecord<{
    readonly chatText: (request: { readonly modelId: string; },) => Promise<{ readonly text: string; }>;
  }>;
  readonly asked: string[];
} {
  /**
   Providers and models asked, in call order.
   */
  const asked: string[] = [];
  /**
   Models Bedrock has already cut once.
   */
  const cut = new Set<string>();

  /**
   Builds one provider's caller.

   @param provider - provider this caller stands for

   @returns Caller that records the call and answers or cuts
   */
  function callerFor(provider: ProviderName,): { readonly chatText: (request: { readonly modelId: string; },) => Promise<{ readonly text: string; }>; } {
    return {
      chatText: async function chatText({ modelId, }: { readonly modelId: string; },): Promise<{ readonly text: string; }> {
        asked.push(`${provider}:${modelId}`,);
        if ((provider === 'bedrock') && slow.includes(modelId,) && (!cut.has(modelId,))) {
          cut.add(modelId,);
          throw new StreamCutShortError({
            label: modelId,
            partialText: '',
            progress: {
              firstByteMs: 15_000,
              maxGapMs: 15_000,
              chars: 30,
              elapsedMs: BOUND_MS,
            },
            cause: new StreamBoundError({
              label: modelId,
              boundMs: BOUND_MS,
            },),
          },);
        }
        return { text: `${provider} answers`, };
      },
    };
  }
  return {
    asked,
    callers: {
      synthetic: callerFor('synthetic',),
      hyper: callerFor('hyper',),
      bedrock: callerFor('bedrock',),
      openrouter: callerFor('openrouter',),
    },
  };
}

/**
 Routes one text call and reports what happened.

 @param client - router under test

 @param modelId - model to ask

 @returns Reply text, or the error thrown

 @example
 ```ts
 const outcome = await ask({ client, modelId: SEAT_BEDROCK_ONLY_TEXT, },);
 ```
 */
function ask(
  {
    client,
    modelId,
  }: {
    readonly client: ReturnType<typeof createRoutingClient>;
    readonly modelId: Parameters<ReturnType<typeof createRoutingClient>['chatText']>[0]['modelId'];
  },
): Promise<{ readonly text: string; } | { readonly thrown: unknown; }> {
  return textCallOutcome({
    client,
    modelId,
    messages: MESSAGES,
    signal: SIGNAL,
  },);
}

/**
 Builds a router over the stubs with a clock the case advances.

 @param slow - models Bedrock cuts on their first call

 @returns Router, the calls asked, and the clock

 @example
 ```ts
 const { client, asked, clock, } = routerOver({ slow: [SEAT_BEDROCK_ONLY_TEXT,], },);
 ```
 */
function routerOver({ slow, }: { readonly slow: readonly string[]; },): {
  readonly client: ReturnType<typeof createRoutingClient>;
  readonly asked: string[];
  readonly clock: { now: number; };
} {
  const { callers, asked, } = stubProviders({ slow, },);
  /**
   Clock the router reads, advanced by the case.
   */
  const clock = { now: 0, };
  return {
    asked,
    clock,
    client: createRoutingClient({
      callers,
      budgets: stubWetBudgets(),
      modelHoldMs: HOLD_MS,
      now: function now(): number {
        return clock.now;
      },
    },),
  };
}

await describe({
  name: 'a call cut at its card\'s stream bound holds that provider out for that model (class one hundred forty-eight, hulicaijia29)',
  children: [
    it({
      name: 'ASKS the next provider serving the model in the same call, and keeps Bedrock out for the model until the hold ends',
      fn: async () => {
        const { client, asked, clock, } = routerOver({ slow: [SEAT_HYPER_TEXT_BEDROCK,], },);

        const first = await ask({
          client,
          modelId: SEAT_HYPER_TEXT_BEDROCK,
        },);
        expect(first,).toEqual({ text: 'hyper answers', },);

        const held = await ask({
          client,
          modelId: SEAT_HYPER_TEXT_BEDROCK,
        },);
        expect(held,).toEqual({ text: 'hyper answers', },);
        expect(asked,).toEqual([
          `bedrock:${SEAT_HYPER_TEXT_BEDROCK}`,
          `hyper:${SEAT_HYPER_TEXT_BEDROCK}`,
          `hyper:${SEAT_HYPER_TEXT_BEDROCK}`,
        ],);

        clock.now = HOLD_MS + 1;
        const again = await ask({
          client,
          modelId: SEAT_HYPER_TEXT_BEDROCK,
        },);
        expect(again,).toEqual({ text: 'bedrock answers', },);
      },
    },),
    it({
      name: 'READS a model only Bedrock serves unreachable without a call while the hold runs, and serves Bedrock\'s other models',
      fn: async () => {
        const { client, asked, } = routerOver({ slow: [SEAT_BEDROCK_ONLY_TEXT,], },);

        const first = await ask({
          client,
          modelId: SEAT_BEDROCK_ONLY_TEXT,
        },);
        expect(('thrown' in first),).toBe(true,);

        const held = await ask({
          client,
          modelId: SEAT_BEDROCK_ONLY_TEXT,
        },);
        // Refused without a call, which is what lets a round count the seat
        // out of its quorum instead of waiting on it.
        expect(('thrown' in held) && (held.thrown instanceof NoProviderForModelError),).toBe(true,);
        expect(asked,).toEqual([`bedrock:${SEAT_BEDROCK_ONLY_TEXT}`,],);

        const other = await ask({
          client,
          modelId: SEAT_HYPER_TEXT_BEDROCK,
        },);
        expect(other,).toEqual({ text: 'bedrock answers', },);
      },
    },),
  ],
},);
