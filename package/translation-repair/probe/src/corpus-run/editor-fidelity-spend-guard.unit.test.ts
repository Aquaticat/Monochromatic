/**
 Tests for the spend guard of the editor fidelity probe: what a reply is measured to have cost, what one call can cost
 at most, and the wrapper that refuses a call, and ends the arm, once the measured spend plus that call's ceiling would
 pass `--max-usd`.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  ChatTextReply,
  ModelClient,
} from '@monochromatic-dev/translation-repair-provider';
import { StatedRefusalError, } from '@monochromatic-dev/translation-repair-glossary';
import {
  callCeilingUsd,
  guardLine,
  measuredUsd,
  pricesOf,
  spendGuardedClient,
} from '../../dist/final/node/index.mjs';
import {
  HAIKU_CARD,
  LOW_CARD,
} from '../editor-fidelity.test-fixture.ts';

/**
 Usage a reply reports.
 */
type CompletionUsage = NonNullable<ChatTextReply['usage']>;

/**
 What every scripted reply reports: a thousand prompt tokens and ten thousand completion tokens, which cost
 (1000 x 2.5 + 10000 x 10) / 1e6 = 0.1025 USD at the Sonnet prices, the prompt priced at the higher of the input and
 cache-write rates.
 */
const REPORTED: CompletionUsage = {
  prompt_tokens: 1_000,
  completion_tokens: 10_000,
};

/**
 One user message of a thousand characters, which a Sonnet call can cost at most (1000 x 2 + 32000 x 10) / 1e6 =
 0.322 USD.
 */
const THOUSAND_CHARS = [{ role: 'user', content: 'x'.repeat(1_000,), },] as const;

/**
 Client that records the model of every exchange and answers each with the usage it is given, or with none.

 @param asked - array each exchange's model id is appended to

 @param reports - the usage every reply reports, empty for replies that report none

 @returns The inner client the guard wraps

 @example
 ```ts
 const inner = scriptedClient({ asked: [], reports: [REPORTED,], },);
 ```
 */
function scriptedClient(
  {
    asked,
    reports,
  }: {
    readonly asked: string[];
    readonly reports: readonly CompletionUsage[];
  },
): ModelClient {
  /**
   The usage every reply reports, absent when the script reports none.
   */
  const [usage,] = reports;
  return {
    chatText: (request,): Promise<ChatTextReply> => {
      asked.push(request.modelId,);
      return Promise.resolve({
        text: 'meow',
        ...((usage === undefined) ? {} : { usage, }),
      },);
    },
    chatJson: <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
      asked.push(request.modelId,);
      return Promise.resolve({
        kind: 'ok',
        value: { edits: [], } as ValueT,
        rawText: '{"edits":[]}',
        ...((usage === undefined) ? {} : { usage, }),
      },);
    },
    quotas: () => Promise.reject(new Error('quotas unused',),),
  };
}

/**
 Asks the guarded client one JSON exchange of a thousand characters.

 @param client - the guarded client

 @param modelId - model named

 @param signal - the arm's signal

 @returns The outcome the client gives

 @example
 ```ts
 await askJson({ client, modelId: LOW_CARD, signal, },);
 ```
 */
function askJson(
  {
    client,
    modelId,
    signal,
  }: {
    readonly client: ModelClient;
    readonly modelId: ChatJsonRequest<unknown>['modelId'];
    readonly signal: AbortSignal;
  },
): Promise<ChatJsonOutcome<unknown>> {
  return client.chatJson({
    modelId,
    messages: THOUSAND_CHARS,
    signal,
    validate: (value: unknown,): value is unknown => value !== undefined,
  },);
}

/**
 What asking raised, caught so a case can read it.

 @param ask - the exchange

 @returns The raised value, or undefined when the exchange completed

 @example
 ```ts
 const raised = await raisedBy({ ask: () => askJson({ client, modelId, signal, },), },);
 ```
 */
async function raisedBy({ ask, }: { readonly ask: () => Promise<unknown>; },): Promise<unknown> {
  try {
    await ask();
  }
  catch (error) {
    return error;
  }
  return undefined;
}

await describe({
  name: '',
  children: [
    describe({
      name: measuredUsd.name,
      children: [
        it({
          name: 'PRICES A REPLY\'S REPORTED TOKENS at the card\'s prices: the prompt at the higher of the input and '
            + 'cache-write rates, since the report folds cached tokens into the prompt count and an overcount only '
            + 'stops the arm sooner, and the completion, thinking included, at the output rate',
          fn: async () => {
            expect(measuredUsd({
              prices: pricesOf({ cardId: LOW_CARD, },),
              usage: REPORTED,
            },),).toBeCloseTo(0.1025, 10,);
          },
        },),

        it({
          name: 'USES THE LONG-PROMPT TIER of a card that has one once the prompt passes its limit, for the whole call',
          fn: async () => {
        // Haiku 5.5 past 100,000 prompt tokens: 0.625 USD cache-write, 2.50 out per million tokens.
            expect(measuredUsd({
              prices: pricesOf({ cardId: HAIKU_CARD, },),
              usage: {
                prompt_tokens: 100_001,
                completion_tokens: 1_000,
              },
            },),).toBeCloseTo(((100_001 * 0.625) + (1_000 * 2.5)) / 1e6, 10,);
          },
        },),
      ],
    },),

    describe({
      name: callCeilingUsd.name,
      children: [
        it({
          name: 'PRICES THE MOST ONE CALL CAN COST: the prompt at one input token a character and the whole completion cap '
            + 'at the output rate',
          fn: async () => {
            expect(callCeilingUsd({
              prices: pricesOf({ cardId: LOW_CARD, },),
              promptTokens: 1_000,
            },),).toBeCloseTo(0.322, 10,);
          },
        },),
      ],
    },),

    describe({
      name: guardLine.name,
      children: [
        it({
          name: 'SAYS WHAT HOLDS THE ARM TO --max-usd, so a log shows the guard was on and at what amount',
          fn: async () => {
            expect(guardLine({ maxUsd: 2, },),).toBe(
              'spend guard: each call is refused, and the arm ends, when the spend measured from the replies so far plus '
                + 'that call\'s ceiling would pass --max-usd 2.0000',
            );
          },
        },),
      ],
    },),

    describe({
      name: spendGuardedClient.name,
      children: [
        it({
          name: 'PASSES A CALL whose ceiling fits what is left and hands back the inner reply untouched, JSON and text '
            + 'alike',
          fn: async () => {
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ asked, reports: [REPORTED,], },),
              maxUsd: 1,
              controller,
            },);
            expect(await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },),).toStrictEqual({
              kind: 'ok',
              value: { edits: [], },
              rawText: '{"edits":[]}',
              usage: REPORTED,
            },);
            expect(await client.chatText({
              modelId: LOW_CARD,
              messages: THOUSAND_CHARS,
              signal: controller.signal,
            },),).toStrictEqual({ text: 'meow', usage: REPORTED, },);
            expect(asked,).toStrictEqual([LOW_CARD, LOW_CARD,],);
            expect(controller.signal.aborted,).toBe(false,);
          },
        },),

        it({
          name: 'STOPS THE ARM BEFORE THE CALL THAT WOULD PASS --max-usd: replies that cost 0.1025 USD each reach the '
            + 'cap, the seven calls that fit are made, the eighth is refused before the inner client is reached, and '
            + 'the refusal names the measured spend, that call\'s ceiling and --max-usd',
          fn: async () => {
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ asked, reports: [REPORTED,], },),
              maxUsd: 1,
              controller,
            },);
            for (let call = 0; call < 7; call += 1) {
              // oxlint-disable-next-line no-await-in-loop -- each call settles, and is measured, before the next is asked
              await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
            }
            expect(asked.length,).toBe(7,);
            const raised = await raisedBy({
              ask: function eighth(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect(raised,).toBeInstanceOf(StatedRefusalError,);
            expect((raised as StatedRefusalError).message,).toBe(
              `the editor fidelity probe will not ask ${LOW_CARD}: the replies so far cost 0.7175 USD as measured, this `
                + 'call can cost 0.3220 USD at most, and together they pass --max-usd 1.0000; the arm ends here, and the '
                + 'rows it finished stay in their files',
            );
            expect(asked.length,).toBe(7,);
          },
        },),

        it({
          name: 'ENDS THE ARM, not one voice of it: the refusal aborts the arm\'s signal with itself as the reason, so '
            + 'every layer that rethrows an abort carries it out, and every later call is refused the same way without '
            + 'reaching the inner client',
          fn: async () => {
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ asked, reports: [REPORTED,], },),
              maxUsd: 0.3,
              controller,
            },);
            const first = await raisedBy({
              ask: function firstCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect(first,).toBeInstanceOf(StatedRefusalError,);
            expect(controller.signal.aborted,).toBe(true,);
            expect(controller.signal.reason,).toBe(first,);
            const second = await raisedBy({
              ask: function secondCall(): Promise<unknown> {
                return client.chatText({
                  modelId: LOW_CARD,
                  messages: THOUSAND_CHARS,
                  signal: controller.signal,
                },);
              },
            },);
            expect(second,).toBe(first,);
            expect(asked,).toStrictEqual([],);
          },
        },),

        it({
          name: 'REFUSES THE FIRST CALL when its ceiling alone passes --max-usd, naming a spend of nothing so far',
          fn: async () => {
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ asked: [], reports: [REPORTED,], },),
              maxUsd: 0.3,
              controller,
            },);
            const raised = await raisedBy({
              ask: function firstCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect((raised as StatedRefusalError).message,).toBe(
              `the editor fidelity probe will not ask ${LOW_CARD}: the replies so far cost 0.0000 USD as measured, this `
                + 'call can cost 0.3220 USD at most, and together they pass --max-usd 0.3000; the arm ends here, and the '
                + 'rows it finished stay in their files',
            );
          },
        },),

        it({
          name: 'LETS A CALL THROUGH that brings the total exactly to --max-usd, since only a total past it is refused',
          fn: async () => {
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ asked, reports: [REPORTED,], },),
              maxUsd: 0.322,
              controller,
            },);
            await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
            expect(asked,).toStrictEqual([LOW_CARD,],);
          },
        },),

        it({
          name: 'COUNTS A REPLY THAT REPORTS NO USAGE AT ITS CEILING, since its cost is unknown and an unknown cost may '
            + 'not be assumed small: two such calls of 0.322 USD stop an arm held to 0.6',
          fn: async () => {
            const asked: string[] = [];
            const controller = new AbortController();
            const client = spendGuardedClient({
              inner: scriptedClient({ asked, reports: [], },),
              maxUsd: 0.6,
              controller,
            },);
            await askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
            const raised = await raisedBy({
              ask: function secondCall(): Promise<unknown> {
                return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
              },
            },);
            expect((raised as StatedRefusalError).message,).toContain('the replies so far cost 0.3220 USD as measured',);
            expect(asked,).toStrictEqual([LOW_CARD,],);
          },
        },),

        it({
          name: 'COUNTS NOTHING FOR A CALL THAT THROWS, which delivered no reply to measure, and keeps asking',
          fn: async () => {
            const asked: string[] = [];
            const controller = new AbortController();
            const failing: ModelClient = {
              ...scriptedClient({ asked, reports: [REPORTED,], },),
              chatJson: () => Promise.reject(new Error('the stream was cut',),),
            };
            const client = spendGuardedClient({
              inner: failing,
              maxUsd: 0.4,
              controller,
            },);
            for (let call = 0; call < 3; call += 1) {
              // oxlint-disable-next-line no-await-in-loop -- each call fails before the next is asked
              expect(
                ((await raisedBy({
                  ask: function failingCall(): Promise<unknown> {
                    return askJson({ client, modelId: LOW_CARD, signal: controller.signal, },);
                  },
                },)) as Error).message,
              ).toBe('the stream was cut',);
            }
            expect(controller.signal.aborted,).toBe(false,);
          },
        },),

        it({
          name: 'PRICES EACH CALL BY ITS OWN MODEL, so a Haiku call is not held to the Sonnet ceiling, and keeps the rest '
            + 'of the client it wraps',
          fn: async () => {
            const asked: string[] = [];
            const controller = new AbortController();
            const inner = {
              ...scriptedClient({ asked, reports: [REPORTED,], },),
              providerHolds: 'held',
            };
            const client = spendGuardedClient({
              inner,
              maxUsd: 0.1,
              controller,
            },);
            await askJson({ client, modelId: HAIKU_CARD, signal: controller.signal, },);
            expect(asked,).toStrictEqual([HAIKU_CARD,],);
            expect((client as ModelClient & { readonly providerHolds: string; }).providerHolds,).toBe('held',);
          },
        },),
      ],
    },),
  ],
},);
